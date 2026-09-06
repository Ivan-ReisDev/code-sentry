"""Rewrite only the first line (shebang) of a pip-generated console script or
Windows launcher, preserving every other byte untouched.

pip bakes the absolute path of the Python interpreter used at install time
into the shebang line -- plain text on Linux ("#!/home/runner/.../python3.12"
followed by the script body), and the same convention embedded at the start
of the binary .exe launcher on Windows ("#!D:\\...\\python.exe" followed by
the zipped payload). That path never exists on the machine that installs the
published package. Replacing it with a portable form ("#!/usr/bin/env
python3" on Linux, "#!python.exe" on Windows, per PEP 397) lets each platform
resolve the interpreter via PATH at run time instead.
"""

import sys


def rewrite_shebang(path: str, new_shebang: str) -> None:
    with open(path, "rb") as f:
        data = f.read()
    if not data.startswith(b"#!"):
        return
    newline = data.find(b"\n")
    if newline == -1:
        return
    original_shebang = data[:newline]
    if b"python" not in original_shebang.lower():
        return
    rest = data[newline + 1 :]
    with open(path, "wb") as f:
        f.write(new_shebang.encode() + b"\n" + rest)


if __name__ == "__main__":
    rewrite_shebang(sys.argv[1], sys.argv[2])
