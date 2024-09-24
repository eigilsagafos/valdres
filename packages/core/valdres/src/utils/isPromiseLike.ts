export const isPromiseLike = <T>(object: any): object is Promise<T> => {
    return object && object.then && typeof object.then === "function"
}
