import { describe, it } from "mocha"
import { assert } from "chai"
import { VectorFunction, vectorized } from "./vectorized.js"

describe("Decorator", () => {
    it("Can be applied with default name", () => {
        interface MathOp {
            calc(x: number): number
        }

        class Squarer implements MathOp {
            calc(x: number) {
                return x ** 2
            }
        }

        class Reciprocator implements MathOp {
            @vectorized()
            calc(x: number) {
                return 1 / x
            }

            calc_vectorized(x: number[]): Float64Array {
                const result = new Float64Array(x.length)
                for (let i = 0; i < x.length; i++)
                    result[i] = 1 / x[i]
                return result
            }
        }

        class Composite implements MathOp {
            constructor(public readonly ops: MathOp[]) { }
            
            calc(x: number): number {
                for (const op of this.ops) x = op.calc(x)
                return x
            }
        }
    })

    it("Can be applied with custom name", () => {
        interface MathOp {
            calc(x: number): number
        }

        class Squarer implements MathOp {
            calc(x: number) {
                return x ** 2
            }
        }

        class Reciprocator implements MathOp {
            @vectorized("calc_vectorized_custom")
            calc(x: number) {
                return 1 / x
            }

            calc_vectorized_custom(x: number[]): Float64Array {
                const result = new Float64Array(x.length)
                for (let i = 0; i < x.length; i++)
                    result[i] = 1 / x[i]
                return result
            }
        }

        class Composite implements MathOp {
            constructor(public readonly ops: MathOp[]) { }
            
            calc(x: number): number {
                for (const op of this.ops) x = op.calc(x)
                return x
            }
        }
    })

    it("Can be applied with custom function", () => {
        interface MathOp {
            calc(x: number): number
        }

        class Squarer implements MathOp {
            calc(x: number) {
                return x ** 2
            }
        }

        class Reciprocator implements MathOp {
            @vectorized(Reciprocator.calc_vectorized_custom)
            calc(x: number) {
                return 1 / x
            }

            static calc_vectorized_custom(this: Reciprocator, x: number[]): Float64Array {
                const result = new Float64Array(x.length)
                for (let i = 0; i < x.length; i++)
                    result[i] = 1 / x[i]
                return result
            }
        }

        class Composite implements MathOp {
            constructor(public readonly ops: MathOp[]) { }
            
            calc(x: number): number {
                for (const op of this.ops) x = op.calc(x)
                return x
            }
        }
    })
})

describe("VectorFunction", () => {
    it("Can be called", () => {
        interface MathOp {
            calc(x: number): number
        }

        class Squarer implements MathOp {
            calc(x: number) {
                return x ** 2
            }
        }

        class Reciprocator implements MathOp {
            @vectorized()
            calc(x: number) {
                return 1 / x
            }

            calc_vectorized(x: number[]): Float64Array {
                const result = new Float64Array(x.length)
                for (let i = 0; i < x.length; i++)
                    result[i] = 1 / x[i]
                return result
            }
        }

        class Inverter implements MathOp {
            @vectorized(Inverter.calc_vectorized)
            calc(x: number): number {
                return ~x
            }

            static calc_vectorized(this: Inverter, x: number[]): Int32Array {
                assert.isTrue(this instanceof Inverter)
                const result = new Int32Array(x.length)
                for (let i = 0; i < x.length; i++)
                    result[i] = ~x[i]
                return result
            }
        }

        class Composite implements MathOp {
            constructor(public readonly ops: MathOp[]) { }
            
            calc(x: number): number {
                for (const op of this.ops) x = op.calc(x)
                return x
            }
        }

        const MathOp_calc_vectorized = new VectorFunction<
            MathOp,
            "calc",
            MathOp["calc"],
            (x: number[]) => number[]
        >("calc")

        const input = [234, 934, 328, 231, 23]
        const ops = [
            new Squarer(),
            new Inverter(),
            new Reciprocator(),
            new Composite([
                new Squarer(),
                new Inverter(),
                new Reciprocator(),
            ])
        ]

        for (const op of ops) {
            const singleResult = input.map(op.calc.bind(op))
            const vectorResult = MathOp_calc_vectorized.call(op, input)
            
            assert.equal(singleResult.length, vectorResult.length)
            for (let i = 0; i < singleResult.length; i++)
                assert.equal(singleResult[i], vectorResult[i])
        }
    })

    it("Can vectorized multiple parameters", () => {
        interface MathOp {
            calc(a: number, b: number): number
        }

        class Addition implements MathOp {
            calc(a: number, b: number): number {
                return a + b
            }
        }

        class Subtraction implements MathOp {
            @vectorized(Subtraction.calc_vectorized)
            calc(a: number, b: number): number {
                return a - b
            }

            private static calc_vectorized(this: Subtraction, a: Float64Array, b: Float64Array): Float64Array {
                const c = new Float64Array(a.length)
                for (let i = 0; i < c.length; i++)
                    c[i] = a[i] - b[i]
                return c
            }
        }

        class Multiplication implements MathOp {
            @vectorized(Multiplication.calc_vectorized)
            calc(a: number, b: number): number {
                return a * b
            }

            private static calc_vectorized(this: Multiplication, a: Float64Array, b: Float64Array): Float64Array {
                const c = new Float64Array(a.length)
                for (let i = 0; i < c.length; i++)
                    c[i] = a[i] * b[i]
                return c
            }
        }

        class Composite implements MathOp {
            constructor(public readonly ops: MathOp[]) { }
            
            calc(a: number, b: number): number {
                for (const op of this.ops) a = op.calc(a, b)
                return a
            }
        }

        const MathOp_calc_vectorized = new VectorFunction<
            MathOp,
            "calc",
            MathOp["calc"],
            (a: number[], b: number[]) => number[]
        >("calc", [0, 1])
        
        const input_A = [234, 934, 328, 231, 23]
        const input_B = [45, 349, 239, 320, 17]
        const ops = [
            new Addition(),
            new Subtraction(),
            new Multiplication(),
            new Composite([
                new Addition(),
                new Subtraction(),
                new Multiplication(),
            ])
        ]

        for (const op of ops) {
            const singleResult = input_A.map((a, i) => op.calc(a, input_B[i]))
            const vectorResult = MathOp_calc_vectorized.call(op, input_A, input_B)
            
            assert.equal(singleResult.length, vectorResult.length)
            for (let i = 0; i < singleResult.length; i++)
                assert.equal(singleResult[i], vectorResult[i])
        }
    })

    it("should fail when vector lengths differ", () => {
        interface MathOp {
            calc(a: number, b: number): number
        }

        class Addition implements MathOp {
            calc(a: number, b: number): number {
                return a + b
            }
        }

        class Subtraction implements MathOp {
            @vectorized(Subtraction.calc_vectorized)
            calc(a: number, b: number): number {
                return a - b
            }

            private static calc_vectorized(this: Subtraction, a: Float64Array, b: Float64Array): Float64Array {
                const c = new Float64Array(a.length)
                for (let i = 0; i < c.length; i++)
                    c[i] = a[i] - b[i]
                return c
            }
        }

        class Multiplication implements MathOp {
            @vectorized(Multiplication.calc_vectorized)
            calc(a: number, b: number): number {
                return a * b
            }

            private static calc_vectorized(this: Multiplication, a: Float64Array, b: Float64Array): Float64Array {
                const c = new Float64Array(a.length)
                for (let i = 0; i < c.length; i++)
                    c[i] = a[i] * b[i]
                return c
            }
        }

        class Composite implements MathOp {
            constructor(public readonly ops: MathOp[]) { }
            
            calc(a: number, b: number): number {
                for (const op of this.ops) a = op.calc(a, b)
                return a
            }
        }

        const MathOp_calc_vectorized = new VectorFunction<
            MathOp,
            "calc",
            MathOp["calc"],
            (a: number[], b: number[]) => number[]
        >("calc", [0, 1])
        
        const input_A = [234, 934, 328, 231, 23]
        const input_B = [45, 349, 239, 320, 17, 23940234, 2349023, 23904, 234]
        const ops = [
            new Addition(),
            new Subtraction(),
            new Multiplication(),
            new Composite([
                new Addition(),
                new Subtraction(),
                new Multiplication(),
            ])
        ]

        for (const op of ops) {
            try {
                MathOp_calc_vectorized.call(op, input_A, input_B)
                assert.ok(false)
            } catch {
                assert.ok(true)
            }
        }
    })
})