/**
 * @author zacharyjuang
 * 2019-07-12
 */
import _ from "lodash";

export function buildSearchRegex(term) {
  return new RegExp("^" + _.escapeRegExp(term), "i")
}
