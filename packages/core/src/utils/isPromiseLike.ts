export const isPromiseLike = (object: any) =>
    object && object.then && typeof object.then === "function"
