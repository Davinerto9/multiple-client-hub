const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: './index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                type: "javascript/esm"
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: 'extLibs', to: 'extLibs' },
                { from: 'index.html', to: '.' },
                { from: 'index.css', to: '.' },
            ],
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser'
        })
    ],
    resolve: {
        extensions: ['.js'],
        fallback: {
            buffer: require.resolve('buffer'),
            stream: require.resolve('stream-browserify'),
            util: require.resolve('util'),
            process: require.resolve('process/browser'),
            fs: false,
            net: false,
            tls: false
        },
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        historyApiFallback: true,
        port: 3001,
    },
};
