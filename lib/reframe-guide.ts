// The reframing method, returned by the `get_reframe_guide` tool.
// Written as the user's own request so the AI follows it as such.
export function reframeGuide(jd: string) {
  return `Using my career record, give me a short analysis of how my experience fits the job posting below. Analyze only; do not write application text.

[Evidence comes only from my career record]
- Read the full list with list_experiences, then read the relevant ones with get_experience. Use search_career to find a specific word.
- Cite the experience ID in parentheses whenever you mention an experience, for example: docs automation (A1-2).
- Do not use lines marked "[unconfirmed]" or "확인 필요", and do not use numbers, counts or results that are not in my record.
- Follow usage rules written in an experience (for example "do not use" or "only with this caveat").
- Do not change what kind of work it was: internal customers are not external customers, collaboration is not people management, English documents are not English meetings, a personal tool is not a team rollout.
- Mark any guess about the company as an estimate.

[Answer format: fits on one screen]
1. Summary: one line on why this role exists and which experience fits best
2. Experience mapping: one table, 3 to 5 rows (Posting requirement | Experience (ID) | Evidence: strong / partial / weak / none)
3. Recruiter's view: up to 3 concerns a recruiter might have, one line each
4. Worth adding: up to 3 questions whose answers would strengthen my record

Use exactly these section names and table headers, translated as below when answering in Korean:
- Korean section names: 한 줄 요약, 경험 맵핑, 채용 담당자 관점, 채워 두면 좋은 정보
- Korean table headers: 공고 요구 | 경험(번호) | 근거 (확실함 / 일부 / 약함 / 없음)

End with one line inviting me to say "more" (in Korean: "자세히") for a deeper look.

[Style]
- Answer in the language I use. Keep quotes from the posting in their original language.
- Use plain words. Do not use analysis jargon such as "lens", "skeptic" or "JTBD".
- Keep sentences short and do not repeat yourself. Avoid filler such as "the key is" or "not just A but B".
- Do not put "my" or "your" in section names or table headers.
- In Korean, write in 해요체, avoid translationese, and use commas instead of middle dots (·) or em dashes.

[When I say "more"]
Go deeper in this order. Keep each item short and give each a plain heading.
- Why this role exists: what breaks if the seat stays empty, who in the company is worried and about what, which people this role connects
- How the work flows: 4 to 6 steps, each marked as stated in the posting or estimated
- Other angles on my experience: work that followed the same flow, cases where people could have done without my work but chose it, invisible work (persuading, teaching, setting standards), explaining the same thing differently to different audiences, how it leads to this role. Write "not in my record" when there is no evidence.
- Questions an interviewer would ask: one sharp question for each strong claim, and whether my current evidence answers it
- If I answer a question raised here, ask whether to add it to my record, and if I agree, add it with update_experience using append.

[Job posting]
${jd}`;
}
