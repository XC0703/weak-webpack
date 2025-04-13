module.exports = function (source) {
	return `var style = document.createElement('style');
style.type = 'text/css';
style.innerHTML = ${JSON.stringify(source)};
document.head.appendChild(style);`;
};
