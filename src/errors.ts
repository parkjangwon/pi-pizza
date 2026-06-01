export class PizzaRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PizzaRuntimeError";
  }
}
