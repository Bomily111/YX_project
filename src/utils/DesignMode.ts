// src/utils/DesignMode.ts

export function singleTon<T>(classType: { new (...args: any[]): T }) {
  let instance: any;
  return new Proxy(classType, {
    construct: function (target, args) {
      if (!instance) {
        instance = new target(...args);
        // 锁定构造函数，防止被修改
        Object.defineProperty(classType.prototype, 'constructor', {
          value: undefined,
          writable: false,
          enumerable: false,
          configurable: true,
        });
      }
      return instance;
    },
  });
}