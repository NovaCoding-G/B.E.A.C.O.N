export const SITE = {
  name: "BEACON",
  fullName:
    "Bayesian Earth-impact Assessment & Cross-source Observation Network",
  version: "0.1.0",
  maintainerName: "NovaCoding",
  maintainerRole: "Maintainer",
  email: "novacodingg@gmail.com",
  githubRepo: "https://github.com/NovaCoding-G/B.E.A.C.O.N",
  get githubIssues() {
    return `${this.githubRepo}/issues`;
  },
  citationYear: 2026,
  disclaimerShort:
    "Not an operational alert system. Data from public NASA/JPL and ESA feeds.",
} as const;
