/**
 * @author zacharyjuang
 * 2019-07-09
 */
import React from "react";
import {Link, NavLink, Redirect, Route, Switch} from "react-router-dom";
import Query from "./query";
import Result from "./result";

class App extends React.Component {
  render() {
    return <div>
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <Link to="/" className="navbar-brand">Sungear</Link>
        <ul className="navbar-nav mr-auto">
          <li className="nav-item">
            <NavLink exact className="nav-link" to="/" activeClassName="active">Home</NavLink>
          </li>
        </ul>
        <div className="d-inline mr-2">
          <a className="github-button" href="https://github.com/zachary822"
             data-size="large"
             aria-label="Follow @zachary822 on GitHub">Follow @zachary822</a>
        </div>
        <div className="d-inline">
          <a className="github-button" href="https://github.com/zachary822/sungear"
             data-icon="octicon-star"
             data-size="large"
             data-show-count="true" aria-label="Star zachary822/sungear on GitHub">Star</a>
        </div>
      </nav>
      <Switch>
        <Route path="/" exact component={Query}/>
        <Route path="/sungear" component={Result}/>
        <Redirect to="/"/>
      </Switch>
    </div>;
  }
}

export default App;
