import { ParsedModule } from "./types";

export function getOrderFromModules(
  modules: Map<string, ParsedModule>,
  filepath: string,
  orders: string[] = []
) {
  const { imports } = modules.get(filepath)!;
  for (const imp of imports) {
    if (!orders.includes(imp.filepath)) {
      orders.push(imp.filepath);
      getOrderFromModules(modules, imp.filepath, orders);
    }
  }
  return orders;
}
