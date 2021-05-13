import {
	leftShift,
	rightShift,
	bitMask,
} from '../bitwiseOperators'

describe('leftShift', () => {
	it('should shift left', () => {
		expect(leftShift(0b0010, 1))
			.toBe(0b0100)
		expect(leftShift(0b0010, 2))
			.toBe(0b1000)
		expect(leftShift(0b0110, 2))
			.toBe(0b11000)
	})
})
describe('rightShift', () => {
	it('should shift bits to the right', () => {
		expect(rightShift(0b0010, 1))
			.toBe(0b0001)
		expect(rightShift(0b0010, 2))
			.toBe(0b0000)
		expect(rightShift(0b1010, 1))
			.toBe(0b0101)
	})
})
describe('bitMask', () => {
	it('should mask bits', () => {
		expect(bitMask(0b1111, 0b1010))
			.toBe(0b1010)
	})
})
