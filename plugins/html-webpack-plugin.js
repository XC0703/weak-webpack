const fs = require('fs');
const path = require('path');

class HtmlWebpackPlugin {
	constructor(options = {}) {
		this.options = Object.assign(
			{
				filename: 'index.html',
				template: path.resolve(__dirname, 'index.html'), // 默认模板路径
				title: 'weak-webpack'
			},
			options
		);
	}

	apply(compiler) {
		compiler.hooks.emit.tapAsync('HtmlWebpackPlugin', (assets, callback) => {
			// 1. 读取模板文件
			fs.readFile(this.options.template, 'utf8', (err, templateContent) => {
				if (err && err.code === 'ENOENT') {
					// 2. 如果模板不存在，使用默认模板
					templateContent = this.getDefaultTemplate();
				} else if (err) {
					return callback(err);
				}

				// 3. 替换模板变量
				const result = templateContent
					.replace(/<%=\s*htmlWebpackPlugin\.options\.title\s*%>/g, this.options.title)
					.replace(
						/<%=\s*htmlWebpackPlugin\.files\.js\s*%>/g,
						Object.keys(assets)
							.filter(name => name.endsWith('.js'))
							.map(name => `<script src="${name}"></script>`)
							.join('\n')
					);

				// 4. 添加HTML文件到资源列表
				assets[this.options.filename] = {
					source: () => result,
					size: () => result.length
				};

				callback();
			});
		});
	}

	getDefaultTemplate() {
		return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title><%= htmlWebpackPlugin.options.title %></title>
</head>
<body>
  <div id="root"></div>
  <%= htmlWebpackPlugin.files.js %>
</body>
</html>`;
	}
}

module.exports = HtmlWebpackPlugin;
