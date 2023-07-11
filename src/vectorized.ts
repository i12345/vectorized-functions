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

export class VectorFunction<
        Target extends object,
        MethodName extends (keyof Target) & (string | symbol),
        Method extends Target[MethodName] & ((...args: any) => any),
        Vectorized extends (this: Target, ...args: any) => ReturnType<Method>[]
    > {
    private sliceIndex: number
    
    constructor(
            public readonly method: MethodName,
            public readonly vectorizedParameterIndices: number[] = [0]
        ) { 
        if (vectorizedParameterIndices.length === 0)
            throw new Error("Must have at least one vectorized parameter")
        
        this.sliceIndex = Math.min(...this.vectorizedParameterIndices)
    }
    
    call(target: Target, ...params: Parameters<Vectorized>): ReturnType<Method>[] {
        if (this.vectorizedParameterIndices.length > 1) {
            const lengths = this.vectorizedParameterIndices.map(index => params[index].length)
            if (lengths.some(length => length != lengths[0]))
                throw new Error("Vector lengths not equal")
        }
        
        const specialized = Reflect.getMetadata(vectorizedKey, target, this.method)
        const specializedFunction = specialized ? (
            typeof specialized === 'function' ?
                specialized :
                (target as any)[specialized as string | symbol]
        ) as Vectorized : undefined

        if (specializedFunction)
            return specializedFunction.call(target, ...params)
        else {
            const items = this.vectorizedParameterIndices.map(index => params[index] as any[])
            const result = new Array<ReturnType<Method>>(items[0].length)
            
            const staticArgs = (params as any[]).slice(0, this.sliceIndex)
            const dynamicArgs = (params as any[]).slice(this.sliceIndex)
            const method = (target[this.method] as Function).bind(target, ...staticArgs)

            for (let i = 0; i < result.length; i++) {
                for (let vectorizedParameterIndexIndex = 0; vectorizedParameterIndexIndex < this.vectorizedParameterIndices.length; vectorizedParameterIndexIndex++) {
                    const vectorizedParameterIndex = this.vectorizedParameterIndices[vectorizedParameterIndexIndex]
                    dynamicArgs[vectorizedParameterIndex - this.sliceIndex] = items[vectorizedParameterIndexIndex][i]
                }
                result[i] = method(...dynamicArgs)
            }

            return result
        }
    }
}