/**
 * @author zacharyjuang
 * 2019-07-09
 */
import React from "react";
import Raphael from 'raphael';
import _ from 'lodash';
import PropTypes from 'prop-types';
import {FontAwesomeIcon as Icon} from "@fortawesome/react-fontawesome";
import {connect} from "react-redux";
import {getSungear} from "../actions";

function mapStateToProps({query, data}) {
  return {
    query,
    data
  };
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function subtract(p1, p2) {
  return [p2[0] - p1[0], p2[1] - p1[1]];
}

function add(p1, p2) {
  return [p2[0] + p1[0], p2[1] + p1[1]];
}

function scaleVector(v, scale = 1, xoffset = 0, yoffset = 0) {
  return [v[0] * scale + xoffset, v[1] * scale + yoffset];
}

function saveSvg(svgEl, name) {
  svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  let svgData = svgEl.outerHTML;
  let preface = '<?xml version="1.0" standalone="no"?>\r\n';
  let svgBlob = new Blob([preface, svgData], {type: "image/svg+xml;charset=utf-8"});
  let svgUrl = URL.createObjectURL(svgBlob);
  let downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = name;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

class SungearBody extends React.Component {
  constructor(props) {
    super(props);

    this.canvas = React.createRef();

    this.circles = [];
    this.labels = [];

    this.state = {
      height: 0,
      data: {},
      items: [],

      itemsCurr: [],
      itemsPast: [],
      itemsFuture: [],

      selected: []
    };

    this.mousedown = false;
    this.mousedownStart = 0;

    this.setHeight = _.debounce(this.setHeight.bind(this), 100);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
  }

  componentDidMount() {
    this.paper = Raphael(this.canvas.current);
    this.canvas.current.addEventListener('wheel', this.handleScroll);
    this.canvas.current.addEventListener('drag', this.handleDrag);
    this.canvas.current.addEventListener('mousedown', (e) => {
      this.prevX = e.x;
      this.prevY = e.y;
      this.mousedown = true;
      this.mousedownStart = e.timeStamp;
    });
    this.canvas.current.addEventListener('mouseup', () => {
      this.mousedown = false;
    });
    this.canvas.current.addEventListener('click', (e) => {
      if (e.timeStamp - this.mousedownStart < 500) {
        this.setState({selected: []});
      }
    });

    this.canvas.current.addEventListener('mousemove', this.handleDrag);

    this.scale = 1;
    this.vX = 0;
    this.vY = 0;

    this.prevX = 0;
    this.prevY = 0;

    this.getSungear();

    this.setHeight();
    window.addEventListener('resize', this.setHeight);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.height && _.size(this.props.data) &&
      (this.state.height !== prevState.height || this.props.data !== prevProps.data)) {
      this.draw();
    }

    if (this.state.selected !== prevState.selected) {
      this.setState({
        items: _(this.state.selected).map((s) => this.props.data.intersects[s][2]).flatten().sortBy().value()
      });

      for (let [i, c] of this.circles.entries()) {
        if (this.state.selected.indexOf(i) !== -1) {
          c.attr("stroke", "#f00");
        } else {
          c.attr("stroke", "#000");
        }
      }
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.setHeight);
  }

  setHeight() {
    this.setState({height: document.documentElement.clientHeight - this.canvas.current.getBoundingClientRect().top},
      () => {
        if (this.paper) {
          this.paper.setSize(this.paper.width, this.state.height);
        }
      });
  }

  getSungear(filterList) {
    let {query} = this.props;
    this.resetView();
    return this.props.getSungear(query, filterList).then(() => {
      this.setState({selected: []});
    });
  }

  narrowClick(e) {
    e.preventDefault();
    if (this.state.items.length) {
      let {items} = this.state;
      this.getSungear(items).then(() => {
        this.setState((state) => {
          return {
            itemsPast: [...state.itemsPast, state.itemsCurr],
            itemsCurr: items,
            itemsFuture: []
          };
        });
      });
    }
  }

  prevClick(e) {
    e.preventDefault();
    let {itemsPast} = this.state;
    let prevs = itemsPast.slice(0, itemsPast.length - 1);
    let curr = itemsPast[itemsPast.length - 1];

    this.getSungear(curr).then(() => {
      this.setState((state) => {
        return {
          itemsCurr: curr,
          itemsPast: prevs,
          itemsFuture: [state.itemsCurr, ...state.itemsFuture]
        };
      });
    });
  }

  nextClick(e) {
    e.preventDefault();
    let {itemsFuture} = this.state;
    let [curr, ...futures] = itemsFuture;

    this.getSungear(curr).then(() => {
      this.setState((state) => {
        return {
          itemsCurr: curr,
          itemsPast: [...state.itemsPast, state.itemsCurr],
          itemsFuture: futures
        };
      });
    });
  }

  resetClick(e) {
    this.resetView();
    this.getSungear().then(() => {
      this.setState({
        itemsCurr: [],
        itemsPast: [],
        itemsFuture: []
      });
    });
  }

  get vW() {
    return this.paper.width * this.scale;
  }

  get vH() {
    return this.paper.height * this.scale;
  }

  handleScroll(e) {
    e.preventDefault();

    let {deltaY} = e;

    if (deltaY > 0) {
      this.scale *= 1.05;
    } else if (deltaY < 0) {
      this.scale *= 0.95;
    }

    window.requestAnimationFrame(() => {
      this.paper.setViewBox(this.vX, this.vY, this.vW, this.vH);
    });
  }

  handleDrag(e) {
    e.preventDefault();
    if (this.mousedown) {
      this.vX += (this.prevX - e.x) * this.scale;
      this.vY += (this.prevY - e.y) * this.scale;

      this.prevX = e.x;
      this.prevY = e.y;

      window.requestAnimationFrame(() => {
        this.paper.setViewBox(this.vX, this.vY, this.vW, this.vH);
      });
    }
  }

  resetView() {
    this.scale = 1;
    this.vX = 0;
    this.vY = 0;

    this.paper.setViewBox(0, 0, this.vW, this.vH);
  }

  draw() {
    let self = this;
    let {height} = this.state;
    let {data} = this.props;
    let {width} = this.canvas.current.getBoundingClientRect();
    let side = Math.min(width, height);
    let polygon, r, polySide;
    let center = [side / 2 + 0.05 * width, side / 2]; // @todo: move to center of page
    const applyHeight = _.partial(scaleVector, _, side, 0.05 * width);
    this.circles = [];
    this.labels = [];

    this.paper.clear();

    let vertices = _.map(data.vertices, ([n, coords]) => {
      return [n, applyHeight(coords)];
    });

    let v = _.map(vertices, 1);

    let intersects = _.map(data.intersects, ([v, c, g, s, arrows]) => {
      return [v, applyHeight(c), g, s * side, _.map(arrows, _.unary(applyHeight))];
    });

    if (_.size(v) === 2) {
      r = distance(...v[0], ...v[1]) / 2;
      polygon = this.paper.path(`
        M ${v[0][0]} ${v[0][1]}
        A ${r} ${r} 0 0 1 ${v[1][0]} ${v[1][1]}
        A ${r} ${r} 0 0 1 ${v[0][0]} ${v[0][1]}
      `);
      polySide = r;
    } else {
      let [v0, ...vr] = v;
      polySide = distance(...v0, ...v[1]);
      r = polySide / (2 * Math.tan(Math.PI / v.length));
      polygon = this.paper.path(`M ${v0[0]} ${v0[1]}\n` + _([...vr, v0]).map((vi) => `L ${vi[0]} ${vi[1]}`).join('\n'));
    }

    for (let [j, [idx, v]] of vertices.entries()) {
      let cv = subtract(center, v);
      let vlen = distance(...cv, 0, 0);
      let vloc = add(scaleVector(cv, (20 + vlen) / vlen), center);

      let rotation = (360 - (360 / vertices.length) * j) % 360;

      let t = this.paper.text(...vloc, idx.toString());
      let tW = t.getBBox().width;

      this.labels.push(t);

      t.rotate(rotation);
      if (tW > polySide) {
        // scale if too big
        let s = polySide / tW;
        t.scale(s, s);
      }

      t.mouseover(function () {
        this.attr("fill", "#f00");

        _.forEach(intersects, (n, i) => {
          if (n[0].indexOf(idx) !== -1) {
            let c = self.circles[i].attr("stroke", "#f00");
            c.toFront();
          }
        });
      });

      t.mouseout(function () {
        this.attr("fill", "#000");

        _.forEach(intersects, (n, i) => {
          if (n[0].indexOf(idx) !== -1 && self.state.selected.indexOf(i) === -1) {
            self.circles[i].attr("stroke", "#000");
          }
        });
      });

      t.click((e) => {
        e.stopPropagation();
        let toSelect = _(intersects).map((n, i) => {
          if (n[0].indexOf(idx) !== -1) {
            return i;
          }
        }).filter(_.negate(_.isUndefined)).value();

        if (e.metaKey) {
          this.setState({
            selected: _.uniq([...this.state.selected, ...toSelect])
          });
        } else if (e.altKey) {
          this.setState({
            selected: _.difference(this.state.selected, toSelect)
          });
        } else {
          this.setState({
            selected: toSelect
          });
        }
      });
    }

    let numThings = _(intersects).map(4).map(_.size).sum();

    for (let [i, n] of intersects.entries()) {
      let c = this.paper.circle(...n[1], n[3]);
      this.circles.push(c);

      c.attr({fill: "#fff", 'fill-opacity': 1});

      c.click((e) => {
        e.stopPropagation();
        if (e.metaKey) {
          if (this.state.selected.indexOf(i) === -1) {
            this.setState({
              selected: [...this.state.selected, i]
            });
          } else {
            this.setState({
              selected: this.state.selected.filter((s) => s !== i)
            });
          }
        } else {
          this.setState({
            selected: [i]
          });
        }
      });

      c.mouseover(function () {
        this.attr({fill: "#f00", 'fill-opacity': 1});

        for (let idx of n[0]) {
          self.labels[_.findIndex(vertices, (v) => v[0] === idx)].attr("fill", "#f00");
        }
      });

      c.mouseout(function () {
        c.attr({fill: "#fff", 'fill-opacity': 1});

        for (let idx of n[0]) {
          self.labels[_.findIndex(vertices, (v) => v[0] === idx)].attr("fill", "#000");
        }
      });

      if (numThings < 600) {
        for (let a of n[4]) {
          let p = this.paper.path(`
          M ${n[1][0]} ${n[1][1]}
          L ${a[0]} ${a[1]}
          `);
          p.attr("arrow-end", "classic");
        }
        c.toFront();
      } else {
        let arrows = this.paper.set();

        c.mouseover(() => {
          c.attr('fill-opacity', 1);
          for (let a of n[4]) {
            let p = this.paper.path(`
            M ${n[1][0]} ${n[1][1]}
            L ${a[0]} ${a[1]}
            `);
            p.attr("arrow-end", "classic");

            arrows.push(p);
            c.toFront();
          }
        });

        c.mouseout(() => {
          c.attr('fill-opacity', 0);
          arrows.remove();
          arrows.clear();
        });
      }
    }
  }

  inverseSelection() {
    let {selected} = this.state;
    let {data: {intersects}} = this.props;

    this.setState({
      selected: _.difference(_.range(_.size(intersects)), selected)
    });
  }

  exportSvg() {
    try {
      saveSvg(this.canvas.current.getElementsByTagName('svg')[0], 'sungear.svg');
    } catch (e) {

    }

  }

  render() {
    let {height, items} = this.state;

    return <div className="container-fluid">
      <div className="row">
        <div ref={this.canvas} className="col-8" style={{width: '100%', height}}/>
        <div className="col-4">
          <div className="row m-1">
            <div className="col">
              <div className="btn-group mr-1">
                <button type="button" className="btn btn-primary" onClick={this.resetView.bind(this)}>
                  <Icon icon="expand" className="mr-1"/>Center
                </button>
                <button type="button" className="btn btn-primary" onClick={this.narrowClick.bind(this)}>
                  <Icon icon="filter" className="mr-1"/>Narrow
                </button>
                <button type="button" className="btn btn-primary" onClick={this.inverseSelection.bind(this)}>
                  <Icon icon="object-group" className="mr-1"/>Inverse
                </button>
                <button type="button" className="btn btn-primary"
                        onClick={this.resetClick.bind(this)}>
                  <Icon icon="sync" className="mr-1"/>Reset
                </button>
              </div>

            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <div>Selections:</div>
              <div className="btn-group">
                <button type="button" className="btn btn-primary"
                        disabled={!this.state.itemsPast.length}
                        onClick={this.prevClick.bind(this)}>
                  <Icon icon="arrow-circle-left" className="mr-1"/>Previous
                </button>
                <button type="button" className="btn btn-primary"
                        disabled={!this.state.itemsFuture.length}
                        onClick={this.nextClick.bind(this)}>
                  Next<Icon icon="arrow-circle-right" className="ml-1"/>
                </button>
              </div>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <div className="btn-group">
                <a className="btn btn-primary" href={'data:text/plain,' + _.join(this.state.items, '\n') + '\n'}
                   download="items.txt">Export Items</a>
                <button type="button" className="btn btn-primary" onClick={this.exportSvg.bind(this)}>Export Image
                </button>
              </div>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <p>
                {items.length.toLocaleString()} items
              </p>
              <div className="overflow-auto border rounded" style={{maxHeight: '50vh'}}>
                <ul className="list-group-flush">
                  {_.map(items, (g, i) => <li key={i} className="list-group-item">{g}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
  }
}

SungearBody.propTypes = {
  query: PropTypes.string,
  data: PropTypes.object,
  getSungear: PropTypes.func
};

const Sungear = connect(mapStateToProps, {getSungear})(SungearBody);

export default Sungear;
