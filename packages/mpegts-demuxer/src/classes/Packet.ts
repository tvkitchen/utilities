export interface Packet {
	data: Uint8Array;
	pts: number;
	dts: number;
	frame_ticks: number;
	program: number; // program number (1,2 ...)
	stream_number: number; // stream number in program
	type: number; // media type / encoding
	stream_id: number; // MPEG stream id
	content_type: number; // 1 - audio, 2 - video
	frame_num: number;
}
