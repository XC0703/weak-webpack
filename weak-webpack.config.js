const path = require('path');
const HtmlWebpackPlugin = require('./plugins/html-webpack-plugin.js');

module.exports = {
	entry: './src/index.js',
	mode: 'development',
	output: {
		path: path.resolve(__dirname, './dist'),
		filename: 'bundle.js'
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [
					'./loaders/style-loader', // 通过 JS 字符串，创建 style node
					'./loaders/css-loader' // 编译 css 使其符合 CommonJS 规范
				]
			}
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			filename: 'template.html'
		})
	]
};
