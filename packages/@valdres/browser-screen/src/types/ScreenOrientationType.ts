/**
 * The four values of `screen.orientation.type`. Declared here rather than
 * borrowed from the DOM library's `OrientationType`, to which it is assignable
 * both ways, so consumers compiling without the DOM library can still type
 * against the package.
 */
export type ScreenOrientationType =
    | "portrait-primary"
    | "portrait-secondary"
    | "landscape-primary"
    | "landscape-secondary"
