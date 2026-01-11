import path from 'path';
import { execSync } from 'child_process';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import { fileURLToPath } from 'url';

const gitHash = execSync('git rev-parse --short HEAD').toString().trim();

const __dirname = path.dirname(fileURLToPath(import.meta.url));


export default {
    entry: './src/index.ts',
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: 'bundle.[contenthash].js',
        path: path.resolve(__dirname, 'dist/webpack'),
        clean: true
    },
    plugins: [
        new webpack.DefinePlugin({
            __GIT_HASH__: JSON.stringify(gitHash),
        }),
        new HtmlWebpackPlugin({
            title: 'Syncotrope',
            template: './public/index.html'
        }),
        // Add this to copy everything from the 'public' directory
        new CopyPlugin({
            patterns: [
                { from: './node_modules/@ffmpeg', to: 'assets' },
                { from: './public/static' },
            ]
        })
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist/webpack'),
        },
    }
};
