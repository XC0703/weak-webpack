module.exports = function (source) {
	return source.replace(/url\(([^)]+)\)/g, 'url($1)');
};
