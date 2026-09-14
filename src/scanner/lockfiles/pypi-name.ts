/** PEP 503 normalization: https://peps.python.org/pep-0503/#normalized-names */
export const normalizePyPiName = (name: string): string => name.toLowerCase().replace(/[-_.]+/g, '-');
