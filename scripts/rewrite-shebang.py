"""Rewrite the baked-in absolute-path shebang of a pip-generated console
script or Windows launcher, preserving every other byte untouched.

pip bakes the absolute path of the Python interpreter used at install time
into every generated script. That path never exists on the machine that
installs the published package, so it must be replaced with a portable form
that each platform's launcher resolves via PATH at run time instead
("#!/usr/bin/env python3" on Linux, "#!python.exe" on Windows, per PEP 397).

The two platforms bake it in completely different ways:

- Linux: the script is a plain text file. The shebang is literally its first
  line, e.g. "#!/home/runner/work/.../python3.12\\n", followed by the rest of
  the script body as-is.

- Windows: the launcher is a PE binary (starts with "MZ") produced by pip's
  distlib ScriptMaker, with a ZIP appended at the end (containing a single
  __main__.py with the actual script body -- no shebang in it). The shebang
  lives in a *fixed-size buffer* placed just before that ZIP, right-aligned
  and left-padded with NUL bytes, e.g.:
      <PE binary><NUL padding>#!D:\\...\\python.exe\\n<ZIP data>
  The launcher reads that buffer at a fixed offset relative to the ZIP, so
  the replacement must keep the buffer's total byte length unchanged --
  it re-pads with NUL bytes on the left, and refuses to write a shebang
  longer than the original buffer.
"""

import sys


def _rewrite_text_shebang(data: bytes, new_shebang: str) -> bytes | None:
    if not data.startswith(b"#!"):
        return None
    newline = data.find(b"\n")
    if newline == -1:
        return None
    if b"python" not in data[:newline].lower():
        return None
    return new_shebang.encode() + b"\n" + data[newline + 1 :]


def _rewrite_pe_launcher_shebang(data: bytes, new_shebang: str) -> bytes | None:
    if not data.startswith(b"MZ"):
        return None
    zip_start = data.find(b"PK\x03\x04")
    if zip_start == -1:
        return None
    shebang_end = data.rfind(b"\n", 0, zip_start) + 1
    if shebang_end == 0:
        return None
    shebang_line_start = data.rfind(b"#!", 0, shebang_end)
    if shebang_line_start == -1:
        return None
    buffer_start = shebang_line_start
    while buffer_start > 0 and data[buffer_start - 1] == 0:
        buffer_start -= 1
    buffer_size = zip_start - buffer_start

    new_line = new_shebang.encode() + b"\n"
    if len(new_line) > buffer_size:
        raise ValueError(
            f"new shebang ({len(new_line)} bytes) does not fit the reserved buffer ({buffer_size} bytes)"
        )
    padded = (b"\x00" * (buffer_size - len(new_line))) + new_line
    return data[:buffer_start] + padded + data[zip_start:]


def rewrite_shebang(path: str, new_shebang: str) -> None:
    with open(path, "rb") as f:
        data = f.read()

    new_data = _rewrite_text_shebang(data, new_shebang) or _rewrite_pe_launcher_shebang(data, new_shebang)
    if new_data is None:
        return

    with open(path, "wb") as f:
        f.write(new_data)


if __name__ == "__main__":
    rewrite_shebang(sys.argv[1], sys.argv[2])
