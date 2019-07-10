/**
 * @author zacharyjuang
 * 2019-07-10
 */
export function setQuery(query) {
  return {
    type: 'SET_QUERY',
    query
  };
}

export function clearQuery() {
  return {
    type: 'CLEAR_QUERY'
  };
}

export function setData(data) {
  return {
    type: 'SET_DATA',
    data
  };
}

export function clearData() {
  return {
    type: 'CLEAR_DATA'
  };
}

export function getSungear(query, filterList) {
  return function (dispatch) {
    let postData = {value: query};

    if (!filterList) {
      return fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      }).then((resp) => resp.json()).then((data) => {
        return dispatch(setData(data));
      });
    } else {
      postData['filter_list'] = filterList;
      return fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      }).then((resp) => resp.json()).then((data) => {
        return dispatch(setData(data));
      });
    }
  };
}
