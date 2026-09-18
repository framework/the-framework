What the tests cover:

- **A waiting agent's question** - an agent that ended waiting yields one card carrying the project, the agent's id, its session name when its branch carries one, what it was asked, when its card was last updated and the whole question; the question is read from the agent's own diary, asked for by the project's path and the agent's id.
- **What yields nothing** - an agent that is working, an agent that ended for good, and a waiting agent whose diary shows it went on after the question each contribute no card.
- **Longest waiting first** - the agent that last spoke the longest ago is listed first.
- **Failed reads** - a project whose agents cannot be read and an agent whose diary cannot be read contribute nothing, and the read itself does not fail.
- **A cloud session's question from the bridge** - a question the bridge holds is joined to the web agent whose record names that cloud session, found in the project's full agent list rather than among the live agents; the card carries what the agent was asked, a gate whose option ids are the option labels (with each option's default flag and detail kept, and whether several may be picked), the time the bridge received the question as its waiting time, and the cloud session's id and `https://claude.ai/code/<session id>` URL; a web agent for another cloud session gets no card.
- **One card per bridged question** - two projects that share the same agent records yield one card, under the first project.
- **A bridged question not offered** - a question whose cloud session matches no agent known here yields no card; when the bridge holds no question at all, the agent lists are not even read.
