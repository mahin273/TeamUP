// Independent re-implementation of the design-doc formula.
// If the service and this function disagree, one of them is wrong. Investigate.
export function expectedScore(p: {
  overlap: number;          // number of required skills the candidate has
  required: number;         // number of required skills in the project
  experienceMatch: number;  // 0..1
  avgEvaluation: number;    // 0..1 (already normalised: (avg - 1) / 4 or avg / 5)
  availabilityMatch: number;// 0 or 1
}) {
  const skillPart = p.required === 0 ? 0 : p.overlap / p.required;
  return skillPart * 0.5 + p.experienceMatch * 0.2 + p.avgEvaluation * 0.2 + p.availabilityMatch * 0.1;
}
