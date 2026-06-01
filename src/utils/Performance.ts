// 文件路径: src/utils/Performance.ts

/**
 * @description: 节流函数，规定指定时间内才执行 
 * @param {*} func
 * @param {*} delay
 * @return {*}
 */
export function throttle(func: any, delay: number) {
	let startTime = 0;
	return function (...args: any[]) {
		const now = new Date().getTime();
		// @ts-ignore
		if (now - startTime >= delay) {
			// @ts-ignore
			func.apply(this, args);
			startTime = now;
		}
	};
}

/**
 * @description: 用户停止当前操作多少秒才执行
 * @param {*} func
 * @param {*} t
 * @return {*}
 */
export function debounce(func: any, t: number) {
	let timerId: any;
	return () => {
		let interval = t || 500;
		if (timerId == undefined) {
			timerId = setTimeout(func, interval); // 在第一次缩放更新
		} else {
			clearTimeout(timerId); // 重新开始计时
			timerId = setTimeout(func, interval);
		}
	};
}