# Componentes de terceiros

Este pacote de distribuição contém, no artefato de release, o Semgrep
Community Edition e uma distribuição portátil do CPython.

- Semgrep CE: licença LGPL-2.1, https://github.com/semgrep/semgrep/blob/develop/LICENSE
- CPython: Python Software Foundation License, https://docs.python.org/3/license.html

Antes de publicar, o workflow de release deve copiar os textos integrais das
licenças das versões efetivamente empacotadas para este artefato e registrar
as versões e checksums em `runtime.lock.json`.
