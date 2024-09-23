import webpack from "webpack"

module.exports = function (context, options) {
    return {
        name: "custom-loader",
        configureWebpack(config, isServer) {
            config.resolve.alias.os = false
            config.plugins.push(
                new webpack.NormalModuleReplacementPlugin(/node:/, resource => {
                    const mod = resource.request.replace(/^node:/, "")
                    resource.request = mod
                }),
            )
        },
    }
}
