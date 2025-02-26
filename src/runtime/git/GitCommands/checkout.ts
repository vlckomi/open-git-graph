import { errors } from "../../handleError";
import { GitCommand } from "./utils";

export const checkout = (branch: string): GitCommand<Promise<void>> => ({
	args: ["checkout", branch],
	async parse(_, p) {
		const [code] = await p;
		if (code && code !== 0) {
			throw errors.gitFailed(code);
		}
	},
});
