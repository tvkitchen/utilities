export class Pmt {
	public mem = new DataView(new ArrayBuffer(512))

	public ptr = 0

	public len = 0

	public offset = 0

	public reset(l: number): void {
		this.len = l
		this.offset = 0
	}
}
