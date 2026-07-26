Topics: [the-framework]
GitHub: [#538](https://github.com/gemstack-land/the-framework/issues/538)

# Roadmap (MVP) 🚀

## TLDR

The MVP roadmap in three stages. **v1**: system prompt (#326, shipped — testing open) + dashboard (#314, shipped — polish open) + start dogfooding. **v2**: the Queue (#624) + agentic PM (tickets #462/#537 shipped; "Suggest new features" preset open) + #625/#626/#627 (shipped). **v3 (YC)** — goal: autonomy: auto-evaluate whether human intervention is needed (#698 open), dogfooding TF on TF (#776, first real-world impact), plus good DX, a landing page, and optionally outreach (Reddit, YouTubers, 10 users).

## Why it matters

This is the prioritization spine for everything else — the "what to show YC" plan. The framing notes carry the vision: massive potential for autonomous agentic development; automatize as much as possible with minimal human intervention. The open boxes (end-to-end testing of the system prompt, "Build instagram clone" with zero intervention, dogfooding gaps, #698, DX paper cuts, landing page) are the remaining MVP work.

## Source

Imported from GitHub issue [gemstack-land/the-framework#538](https://github.com/gemstack-land/the-framework/issues/538), created 2026-07-15, label: `the-framework ♻️`, 3 comments.

### Original description

## 1. MVP v1

- [x] https://github.com/gemstack-land/gemstack/issues/326
  - [ ] Test: is everything working? Any issues with it?
    - The result should be: analyzes user prompt, auto-plan, ask user sensible questions, no implicit-laziness
  - [ ] Test: "Build instgram clone" => high quality AI work (thanks to the system prompt) with zero human intervention?
- [x] https://github.com/gemstack-land/gemstack/issues/314
  - [ ] Test: is everything working? Any issues with it? Let's polish quick-win? Big UX paper cuts we should fix (we can fix minor paper cuts in post-MVP)
- [ ] Dogfooding — the ultimate test here is we start using The Framework ourselves: what missing to get there?

## 2. MVP v2

- [ ] https://github.com/gemstack-land/gemstack/issues/624
- [ ] Agentic PM (Product Mangement)
  - [x] https://github.com/gemstack-land/gemstack/issues/462
  - [x] https://github.com/gemstack-land/gemstack/issues/537
  - [ ] New preset "Suggest new features"
- [x] https://github.com/gemstack-land/gemstack/issues/625
- [x] https://github.com/gemstack-land/gemstack/issues/626
- [x] https://github.com/gemstack-land/gemstack/issues/627

## 3.MVP v3 (YC)

Goal: autonomy

- [x] https://github.com/gemstack-land/gemstack/issues/685
- [x] https://github.com/gemstack-land/gemstack/issues/773
- [x] https://github.com/gemstack-land/gemstack/issues/882
- Auto evalute whether human intervention needed or not:
  - [ ] https://github.com/gemstack-land/gemstack/issues/698
  - [x] https://github.com/gemstack-land/gemstack/issues/891
  - [x] https://github.com/gemstack-land/gemstack/issues/892
- [x] https://github.com/gemstack-land/gemstack/issues/680

> [!NOTE]
> Massive(?) potential for autonomous agentic development.

> [!NOTE]
> TF's vision: automatize as much as possible, with minimal human intervention.

Let's then start dogfooding it for TF and achieve good autonomy results:
- [x] https://github.com/gemstack-land/gemstack/issues/776

> [!NOTE]
> First real-world impact of TF! Leading to massive(?) positive side-effects in many regards (confidence, communcation, ...)

Also crucial — UX and communication:
- [ ] Good DX (not perfect, but let's try to fix major paper cuts)
- [ ] Landing page

Optionally:
- [ ] Reach out on Reddit and other forums
- [ ] Reach out to YouTubers
- [ ] Get 10 users

### Notes from the GitHub thread

- MVP v3 (YC) was added later, then #680 ("a nice showcase of TF's vision of taking care of everything — it's an *AI framework*") and #882 were appended.
