export type Payload = {
	buffer: Uint8Array[];
	buflen: number;
	pts: number;
	dts: number;
	frame_ticks: number;
};
