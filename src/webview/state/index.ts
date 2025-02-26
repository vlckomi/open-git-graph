import { GitCommit } from "../../types/git.js";
import {
	FromRuntimeMessage,
	FromWebviewMessage,
} from "../../types/messages.js";
import { Req, req } from "../../types/req.js";
import { Graph, createGraphNodes } from "./createGraphNodes/index.js";
import { groupBy } from "./groupBy.js";
import { GraphTag, toGraphTags } from "./toGraphTags.js";
import { create } from "./zustand.js";

const api = acquireVsCodeApi();

interface WebviewState {
	graph: Req<Graph>;
	tags: Req<Record<string, GraphTag[]>>;
	stashes: Req<Record<string, GraphTag[]>>;

	commits: Record<string, Req<GitCommit>>;

	expandedCommit?: string;

	dispatch: (msg: FromWebviewMessage | WebviewStoreAction) => unknown;
}

type WebviewStoreAction = ExpandCommitAction;
type ExpandCommitAction = { type: "EXPAND_COMMMIT"; commit: string };

export const useWebviewStore = create<WebviewState>((set, get) => {
	const state = api.getState();

	return {
		graph: state?.graph ?? req.empty(),
		tags: state?.tags ?? req.empty(),
		stashes: state?.stashes ?? req.empty(),
		commits: state?.commits ?? {},
		expandedCommit: state?.expandedCommit,

		dispatch: (msg) => {
			const state = get();
			try {
				switch (msg.type) {
					case "INIT":
					case "REFRESH":
					case "CHECKOUT":
						set({
							graph: req.waiting(state?.graph.data),
							tags: req.waiting(state?.tags.data),
						});
						api.postMessage(msg);
						break;
					case "EXPAND_COMMMIT":
						set((s) => ({
							expandedCommit:
								s.expandedCommit === msg.commit ? undefined : msg.commit,
						}));
						break;
					case "SHOW_DIFF":
						api.postMessage(msg);
						break;
					default:
						msg satisfies never;
						break;
				}
			} catch (e) {
				throw e;
			} finally {
				api.setState(get());
			}
		},
	};
});

export const receive = (msg: FromRuntimeMessage) => {
	try {
		switch (msg.type) {
			case "SET_COMMITS":
			case "APPEND_COMMITS": {
				useWebviewStore.setState((s) => ({
					graph: req.map(msg.commits, (c) =>
						createGraphNodes(
							c,
							msg.type === "APPEND_COMMITS" ? s.graph.data : undefined,
						),
					),
				}));
				break;
			}
			case "SET_REFS": {
				useWebviewStore.setState({
					tags: req.map(msg.refs, (refs) =>
						Object.fromEntries(toGraphTags(groupBy(refs, (r) => r.hash))),
					),
				});
				break;
			}
			case "SET_STASHES": {
				useWebviewStore.setState({
					stashes: req.map(msg.stashes, (refs) =>
						Object.fromEntries(toGraphTags(groupBy(refs, (r) => r.hash))),
					),
				});
				break;
			}
			default: {
				msg satisfies never;
			}
		}
	} catch (e) {
		throw e;
	} finally {
		api.setState(useWebviewStore.getState());
	}
};

declare function acquireVsCodeApi(): {
	getState: () => Omit<WebviewState, "dispatch"> | null;
	postMessage: (message: FromWebviewMessage) => void;
	setState: (state: Omit<WebviewState, "dispatch">) => void;
};
