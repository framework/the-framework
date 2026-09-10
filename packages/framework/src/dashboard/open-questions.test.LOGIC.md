What the tests cover:

- **The whole gate is kept** - an open gate is read back with its title, every option and the recommended option; a gate followed by its resolution is closed; a gate asked again after being resolved is open again.
- **A parked agent's question** - a running agent parked on a gate yields one card carrying the project, the agent's id, its session name when its branch carries one, what it was asked, when it last spoke and the whole gate; the gate is read from the agent's own checkout, not the project's root.
- **What yields nothing** - a stopped agent, a running agent parked on nothing, and an agent whose record says it is parked while its event stream shows the gate already answered each contribute no card.
- **Longest waiting first** - the agent that last spoke the longest ago is listed first.
- **Failed reads** - a project whose agents cannot be read and an agent whose event stream cannot be read contribute nothing, and the read itself does not fail.
- **A cloud session's question from the bridge** - a question the bridge holds is joined to the web agent whose record names that cloud session, found in the project's full agent list rather than among the live agents; the card carries what the agent was asked, a gate whose option ids are the option labels (with each option's default flag and detail kept, and whether several may be picked), the time the bridge received the question as its waiting time, and the cloud session's id and `https://claude.ai/code/<session id>` URL; a web agent for another cloud session gets no card.
- **One card per bridged question** - two projects that share the same agent records yield one card, under the first project.
- **A bridged question not offered** - a question whose cloud session matches no agent known here yields no card; when the bridge holds no question at all, the agent lists are not even read.
