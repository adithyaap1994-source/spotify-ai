export const PART1_INSIGHTS = {
  segment: "Comfort Loopers with Discovery Intent / Passive Discoverers",
  userIntent: "Discover fresh music without losing familiar taste or requiring setup.",
  painPoints: [
    "Recommendations feel repetitive or recycled.",
    "Discovery can feel like work.",
    "Recommendations can miss current mood, activity, and energy.",
    "Over-personalized algorithms can trap users in a taste bubble.",
    "Users want control over how adventurous discovery feels."
  ],
  mvpRules: [
    "Preserve emotional safety with a familiar anchor before branching.",
    "Avoid recently repeated songs and artists.",
    "Prefer adjacent novelty over random novelty unless the user asks for surprise.",
    "Use mood, time, activity, and comfort score as ranking constraints.",
    "Keep explanations short, concrete, and tied to user context.",
    "Prefer low-effort recommendations that need no setup."
  ],
  feedbackEvents: ["saved", "skipped", "too_familiar", "too_random", "wrong_mood", "already_know_artist"]
};

export function compactPart1Insights() {
  return {
    segment: PART1_INSIGHTS.segment,
    userIntent: PART1_INSIGHTS.userIntent,
    promptRules: PART1_INSIGHTS.mvpRules,
    feedbackEvents: PART1_INSIGHTS.feedbackEvents
  };
}
