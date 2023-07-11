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
    constructor(
            public readonly method: MethodName,
            public readonly vectorizedParameterIndex: number = 0
        ) { }
    
    call(target: Target, ...params: Parameters<Vectorized>): ReturnType<Method>[] {
        const specialized = Reflect.getMetadata(vectorizedKey, target, this.method)
        const specializedFunction = specialized ? (
            typeof specialized === 'function' ?
                specialized :
                (target as any)[specialized as string | symbol]
        ) as Vectorized : undefined

        if (specializedFunction)
            return specializedFunction.call(target, ...params)
        else {
            const items = params[this.vectorizedParameterIndex] as any[]
            const result = new Array<ReturnType<Method>>(items.length)
            const staticArgs = (params as any[]).slice(0, this.vectorizedParameterIndex)
            const dynamicArgs = (params as any[]).slice(this.vectorizedParameterIndex)
            const method = (target[this.method] as Function).bind(target, ...staticArgs)

            for (let i = 0; i < items.length; i++) {
                dynamicArgs[0] = items[i]
                result[i] = method(...dynamicArgs)
            }

            return result
        }
    }
}