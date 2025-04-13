const options = require('./weak-webpack.config');
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');
const { SyncHook, AsyncSeriesHook } = require('tapable');

// 创建一个 MiniWebpack 类
class MiniWebpack {
	constructor(options) {
		// 配置项
		this.options = options;
		// 定义生命周期钩子
		this.hooks = {
			compile: new SyncHook(),
			afterCompile: new SyncHook(),
			emit: new AsyncSeriesHook(['assets']),
			done: new SyncHook()
		};

		// 注册插件
		if (Array.isArray(this.options.plugins)) {
			this.options.plugins.forEach(plugin => plugin.apply(this));
		}
	}

	// 处理loader
	applyLoaders(filename, source) {
		let processed = source;
		const rules = this.options.module?.rules || [];

		for (const rule of rules) {
			if (rule.test.test(filename)) {
				const loaders = Array.isArray(rule.use) ? [...rule.use].reverse() : [rule.use];
				for (const loader of loaders) {
					let loaderPath;
					if (typeof loader === 'string') {
						loaderPath = loader; // 如果是字符串，直接使用
					} else if (typeof loader === 'object' && loader.loader) {
						loaderPath = loader.loader; // 如果是对象，提取 loader 属性
					} else {
						throw new Error(`Invalid loader configuration: ${JSON.stringify(loader)}`);
					}

					const loaderFn = require(loaderPath);

					processed = loaderFn(processed);
				}
			}
		}
		return processed;
	}

	// 解析入口文件
	parse(filename) {
		// 利用 Node 的核心模块 fs 读取文件
		let fileBuffer = fs.readFileSync(filename, 'utf-8');
		// 应用loader转换
		fileBuffer = this.applyLoaders(filename, fileBuffer);

		// 基于 @babel/parser 解析文件得到 AST
		const ast = parser.parse(fileBuffer, { sourceType: 'module' });
		const deps = {}; // 用来收集依赖
		// 遍历 AST，收集依赖
		traverse(ast, {
			ImportDeclaration({ node }) {
				const dirname = path.dirname(filename);
				const absPath = './' + path.join(dirname, node.source.value);
				deps[node.source.value] = absPath;
			}
		});
		// 代码转换，将代码转换成浏览器可执行的代码
		const { code } = babel.transformFromAst(ast, null, {
			presets: ['@babel/preset-env']
		});
		const moduleInfo = { filename, deps, code };
		return moduleInfo;
	}

	// 收集模块依赖图
	analyse(file) {
		// 定义依赖图
		const depsGraph = {};
		// 首先获取入口的信息
		const entry = this.parse(file);
		const temp = [entry];
		for (let i = 0; i < temp.length; i++) {
			const item = temp[i];
			const deps = item.deps;
			if (deps) {
				// 遍历模块的依赖，递归获取模块信息
				for (const key in deps) {
					if (deps.hasOwnProperty(key)) {
						temp.push(this.parse(deps[key]));
					}
				}
			}
		}
		temp.forEach(moduleInfo => {
			depsGraph[moduleInfo.filename] = {
				deps: moduleInfo.deps,
				code: moduleInfo.code
			};
		});
		return depsGraph;
	}

	// 生成最终执行的代码
	generate(graph, entry) {
		// 是一个立即执行函数
		return `(function(graph){
        function require(file) {
            var exports = {};
            function absRequire(relPath){
                return require(graph[file].deps[relPath])
            }
            (function(require, exports, code){
                eval(code)
            })(absRequire, exports, graph[file].code)
            return exports
        }
        require('${entry}')
    })(${graph})`;
	}

	// 指定打包后的文件的目录
	outputFile(output, code) {
		const { path: dirPath, filename } = output;
		const outputPath = path.join(dirPath, filename);
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath);
		}
		fs.writeFileSync(outputPath, code, 'utf-8');
	}

	// 将所有打包逻辑串起来
	bundle() {
		const { entry, output } = this.options;

		// 触发compile钩子
		this.hooks.compile.call(); // 编译开始触发

		// 分析入口文件, 生成依赖图
		const graph = this.analyse(entry);

		// 触发afterCompile钩子
		this.hooks.afterCompile.call(); // // 编译结束触发

		// 生成代码
		const graphStr = JSON.stringify(graph);
		const code = this.generate(graphStr, entry);

		// 准备资源
		const assets = {
			[output.filename]: {
				source: () => code,
				size: () => code.length
			}
		};

		// 输出文件到指定目录
		// 触发emit钩子（异步）
		this.hooks.emit.callAsync(assets, err => {
			// 资源生成触发（异步）
			if (err) throw err;

			// 确保输出目录存在
			const dirPath = output.path;
			if (!fs.existsSync(dirPath)) {
				fs.mkdirSync(dirPath, { recursive: true });
			}

			// 写入所有资源文件
			Object.entries(assets).forEach(([filename, asset]) => {
				const filePath = path.join(dirPath, filename);
				fs.writeFileSync(filePath, asset.source(), 'utf-8');
			});

			// 触发done钩子
			this.hooks.done.call();
		});
	}
}

// 实例化并运行打包
const miniWebpack = new MiniWebpack(options);
miniWebpack.bundle();
