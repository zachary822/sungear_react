/**
 * @author zacharyjuang
 * 2019-07-09
 */
import React from "react";
import {Redirect, Route, Switch, Link, NavLink} from "react-router-dom";
import Sungear from "./sungear";
import Query from "./query";

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
      </nav>
      <Switch>
        <Route path="/" exact component={Query}/>
        <Route path="/sungear" component={Sungear}/>
        <Redirect to="/"/>
      </Switch>
    </div>;
  }
}

export default App;
