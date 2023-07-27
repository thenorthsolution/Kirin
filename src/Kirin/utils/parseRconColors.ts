import { replaceAll } from 'fallout-utility';

export function parseRconColors(text: string) {
	var pre = "B'";

	text = replaceAll(text, `${pre}0`, "\x1B[30m");
	text = replaceAll(text, `${pre}1`, "\x1B[34m");
	text = replaceAll(text, `${pre}2`, "\x1B[32m");
	text = replaceAll(text, `${pre}3`, "\x1B[36m");
	text = replaceAll(text, `${pre}4`, "\x1B[31m");
	text = replaceAll(text, `${pre}5`, "\x1B[35m");
	text = replaceAll(text, `${pre}6`, "\x1B[33m");
	text = replaceAll(text, `${pre}7`, "\x1B[37m");
	text = replaceAll(text, `${pre}8`, "\x1B[90m");
	text = replaceAll(text, `${pre}9`, "\x1B[94m");
	text = replaceAll(text, `${pre}a`, "\x1B[92m");
	text = replaceAll(text, `${pre}b`, "\x1B[96m");
	text = replaceAll(text, `${pre}c`, "\x1B[91m");
	text = replaceAll(text, `${pre}d`, "\x1B[95m");
	text = replaceAll(text, `${pre}e`, "\x1B[93m");
	text = replaceAll(text, `${pre}f`, "\x1B[97m");
	text = replaceAll(text, `${pre}k`, "\x1B[6m");
	text = replaceAll(text, `${pre}l`, "\x1B[1m");
	text = replaceAll(text, `${pre}m`, "\x1B[9m");
	text = replaceAll(text, `${pre}n`, "\x1B[4m");
	text = replaceAll(text, `${pre}o`, "\x1B[3m");
	text = replaceAll(text, `${pre}r`, "\x1B[0m");

	return text + "\x1B[0m";
}
