/**
 * Thrown where Recoil would do something this adapter cannot reproduce
 * faithfully on Valdres 1.0, instead of silently doing something else.
 * `feature` names the refused capability; the message says what to use.
 */
export class UnsupportedRecoilFeatureError extends Error {
    readonly code = "VALDRES_RECOIL_UNSUPPORTED"
    readonly feature: string

    constructor(feature: string, detail: string) {
        super(`@valdres-react/recoil does not support ${feature}. ${detail}`)
        this.name = "UnsupportedRecoilFeatureError"
        this.feature = feature
    }
}
