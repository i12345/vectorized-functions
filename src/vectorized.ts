import 'reflect-metadata'

const vectorizedKey = Symbol("vectorized")

export const vectorized = (specialVersion?: string | symbol | Function): MethodDecorator =>
    (target, propertyKey) =>
        Reflect.defineMetadata(
            vectorizedKey,
            specialVersion ?? `${String(propertyKey)}_vectorized`,
            target,
            propertyKey
        )

export abstract class VectorFunction<
        Target extends object,
        MethodName extends (keyof Target) & (string | symbol),
        Method extends Target[MethodName] & ((this: Target, ...args: any[]) => any),
        VectorizedArgs extends any[],
        Vectorized extends (this: Target, ...args: VectorizedArgs) => any
    > {
    constructor(
            public readonly method: MethodName
        ) {
    }
    
    call(target: Target, ...params: Parameters<Vectorized>): ReturnType<Vectorized> {
        const specialized = Reflect.getMetadata(vectorizedKey, target, this.method)
        const specializedFunction = specialized ? (
            typeof specialized === 'function' ?
                specialized :
                (target as any)[specialized as string | symbol]
        ) as Vectorized : undefined

        if (specializedFunction)
            return specializedFunction.call(target, ...params)
        else return this.vectorizeSingularCall(target, <Method>target[this.method], params)
    }

    protected abstract vectorizeSingularCall(
        target: Target,
        singularMethod: Method,
        params: VectorizedArgs
    ): ReturnType<Vectorized>
}

export type SingleOrArray<
        VectorizedArgs extends boolean[],
        T extends any[]
    > = {
    [K in keyof T]:
        K extends keyof any[] ?
            T[K] :
            K extends keyof VectorizedArgs ?
                VectorizedArgs[K] extends true ?
                    T[K][] : T[K] :
                T[K]
}

export type ArrayVectorizedFunction<
        Target extends object,
        Method extends (this: Target, ...args: any[]) => any,
        VectorizedArgs extends boolean[],
    > = (
        this: Target,
        ...args: SingleOrArray<VectorizedArgs, Parameters<Method>>
    ) => ReturnType<Method>[]

export class ArrayVectorFunction<
        Target extends object,
        MethodName extends (keyof Target) & (string | symbol),
        Method extends Target[MethodName] & ((this: Target, ...args: any[]) => any),
        VectorizedArgs extends boolean[],
        Vectorized extends ArrayVectorizedFunction<Target, Method, VectorizedArgs>
    > extends
    VectorFunction<
            Target,
            MethodName,
            Method,
            Parameters<Vectorized>,
            Vectorized
        > {
    private readonly sliceIndex: number
    private readonly vectorizedParameterIndices: number[]

    constructor(
            method: MethodName,
            public readonly vectorizedParameterFlags: VectorizedArgs
        ) {
        super(method)

        this.vectorizedParameterIndices =
            vectorizedParameterFlags
            .map((flag, index) => ({ flag, index }))
            .filter(({ flag }) => flag)
            .map(({ index }) => index)

        if (this.vectorizedParameterIndices.length === 0)
            throw new Error("Must have at least one vectorized parameter")
        
        this.sliceIndex = Math.min(...this.vectorizedParameterIndices)
    }
    
    vectorizeSingularCall(target: Target, singularMethod: Method, params: Parameters<Vectorized>): ReturnType<Vectorized> {
        if (this.vectorizedParameterIndices.length > 1) {
            const lengths = this.vectorizedParameterIndices.map(index => params[index].length)
            if (lengths.some(length => length != lengths[0]))
                throw new Error("Vector lengths not equal")
        }

        const items = this.vectorizedParameterIndices.map(index => params[index] as any[])
        const result = new Array<ReturnType<Method>>(items[0].length)
            
        const staticArgs = (params as any[]).slice(0, this.sliceIndex)
        const dynamicArgs = (params as any[]).slice(this.sliceIndex)
        const method = singularMethod.bind(target, ...staticArgs)

        for (let i = 0; i < result.length; i++) {
            for (let vectorizedParameterIndexIndex = 0; vectorizedParameterIndexIndex < this.vectorizedParameterIndices.length; vectorizedParameterIndexIndex++) {
                const vectorizedParameterIndex = this.vectorizedParameterIndices[vectorizedParameterIndexIndex]
                dynamicArgs[vectorizedParameterIndex - this.sliceIndex] = items[vectorizedParameterIndexIndex][i]
            }
            result[i] = method(...dynamicArgs)
        }

        return <ReturnType<Vectorized>>result
    }
}