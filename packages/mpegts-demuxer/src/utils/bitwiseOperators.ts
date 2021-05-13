export function leftShift(x: number, amount: number): number {
	return x * 2 ** amount
}

export function rightShift(x: number, amount: number): number {
	return Math.trunc(x / 2 ** amount)
}

// This is one of those rare applications where we actually need bitwise operators
// as I don't know if there is a great way to do a bit mask without using `&`
/* eslint-disable no-bitwise */
export function bitMask(x: number, mask: number): number { return x & mask }
/* eslint-enable no-bitwise */
