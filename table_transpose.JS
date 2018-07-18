'use strict';

(function () {

	var viz = {
		id: 'measures-to-rows',
		label: 'Measures to Rows',
		options: {
			colLabels: {
				type: 'array',
				section: 'Labels',
				label: 'Override Column Names',
				placeholder: '7 Days Trailing|Last Week,...'
			},
			measureLabels: {
				type: 'array',
				section: 'Labels',
				label: 'Override Measure Names',
				placeholder: 'Gpv Fxd Usd|GPV,...'
			},
			hideMeasureLabels: {
				type: 'boolean',
				section: 'Labels',
				label: 'Hide Measure Names',
				default: 'false',
			},
			measureSort: {
				type: 'array',
				section: 'Sorts',
				label: 'Override Measure Sort Order',
				placeholder: '0,1,4,2,5,3,...'
			},
			measureSortFirst: {
				type: 'boolean',
				section: 'Sorts',
				label: 'Sort Measures before Dimensions',
			},
			pivotSort: {
				type: 'array',
				section: 'Sorts',
				label: 'Override Pivot Sort Order',
				placeholder: '0,1,4,2,5,3,...'
			},
			pivotsAsDelta: {
				type: 'boolean',
				section: 'Deltas',
				label: 'Display Pivots as Delta from 1st',
				default: 'false',
				order: 0
			},
			sigFigs: {
				type: 'number',
				section: 'Deltas',
				label: 'Sig Figs',
				hidden: function hidden(config, queryResponse) {
					return config.pivotsAsDelta === false;
				},
				default: 2,
				order: 1
			},
			colorDeltas: {
				type: 'boolean',
				section: 'Deltas',
				label: 'Color Code Deltas',
				hidden: function hidden(config, queryResponse) {
					return config.pivotsAsDelta === false;
				},
				default: 'false',
				order: 2
			},
			invertedMeasures: {
				type: 'array',
				section: 'Deltas',
				hidden: function hidden(config, queryResponse) {
					return config.pivotsAsDelta === false || config.colorDeltas === false;
				},
				label: 'Invert Colors for Measures',
				placeholder: 'GPV, Revenue, Count,...',
				order: 3
			}
		}
	};

	viz.create = function (element, settings) {
		var div = d3.select(element).append('div');
		div.attr('id', 'transposed-table-container').style({
			'height': '100%',
			'width': '100%'
		});

		var tbl = div.append('table');
		tbl.attr('id', 'transposed-table').classed('lk-vis-table stuck ng-isolate-scope lk-vis-table-editable-theme', true);
	};

	viz.update = function (data, element, settings, resp) {
		var dimensions = resp.fields.dimension_like;
		var measures = resp.fields.measure_like;
		var pivots_meta = resp.fields.pivots; // dimensions that are pivoted
		var cols = resp.pivots; // pivot values

		var table = d3.select(element).select('table');

		if (settings.measureSort) {
			if (settings.measureSort.length) {
				var measureSort = settings.measureSort;
				measureSort = measureSort.filter(function (d) {
					return d < measures.length;
				});
				measures = measureSort.map(function (d) {
					return measures[+d];
				});
			}
		}

		if (settings.pivotSort) {
			if (settings.pivotSort.length) {
				var pivotSort = settings.pivotSort;
				pivotSort = pivotSort.filter(function (d) {
					return d < cols.length;
				});
				cols = pivotSort.map(function (d) {
					return cols[+d];
				});
			}
		}
		var transposed_data = [];

		data.forEach( // for each row in the data
		function (data) {
			measures.forEach( // for each measure
			function (m) {
				var row = {};
				row[m.name] = data[m.name]; // add the measure
				dimensions.forEach( // for each dimension
				function (d) {
					row[d.name] = data[d.name]; // add the dimensions to this row
				});
				transposed_data.push(row); // add the measure the row, adding a row for each measure
			});
		}
		);

		if (settings.measureSortFirst) {
			var sorted = measures.map(
				function(m) {
					var filtered = transposed_data.filter(
						function(d) {
							var keys = Object.keys(d);
							return keys.indexOf(m.name) !== -1 ;
						}
					)
					return filtered;
				}
			)
			data = [].concat.apply([],sorted); // overwrite the data
		}
		else {
			data = transposed_data;
		}

		// create the header with nulls for each dimension and 1 for the transposed measures
		var tableHeaderData = [];
		if (!settings.hideMeasureLabels) {
			tableHeaderData.push(null);
		};
		dimensions.forEach(function (d) {
			tableHeaderData.push(null);
		});

		// add the pivot column names to the header
		cols.forEach(function (c) {
			var col_name = Object.keys(c.data);
			if (typeof settings.colLabels !== "undefined") {
				var mapping = {};
				settings.colLabels.map(function (col) {
					return mapping[col.split('|')[0]] = col.split('|')[1];
				});
				var lbl = mapping[c.data[col_name]] || c.data[col_name];
				tableHeaderData.push(lbl);
			} else {
				tableHeaderData.push(c.data[col_name]);
			}
		});

		var thead = table.selectAll('thead').data([[tableHeaderData]]).classed('ng-scope', true);

		thead.enter().append('thead');

		var theadRow = thead.selectAll('tr').data(function (d) {
			return d;
		}).classed('ng-pristine ng-untouched ng-valid ng-scope ng-isolate-scope ui-sortable ng-empty', true);

		theadRow.enter().append('tr');

		var theadTd = theadRow.selectAll('th').data(function (d) {
			return d;
		}).classed('pivot undraggable ng-scope', true);

		theadTd.enter().append('th');

		theadTd.exit().remove();


		theadTd.text(function (d) {
			if (d == '$$$_row_total_$$$') {
				return 'Row Totals';
			} else {
				return d;
			}
		});


		theadTd.each(function (d) {
			if (d === null) {
				d3.select(this).html('<span>&#8203;</span>');
			}
		});

		// body
		var tbody = table.selectAll('tbody').data([data]);

		tbody.enter().append('tbody');

		// append row for each row in data
		var trs = tbody.selectAll('tr').data(function (data) {
			return data;
		});

		trs.enter().append('tr');

		trs.exit().remove();

		// assemble a row
		var tds = trs.selectAll('td').data(function (datum) {
			var tdData = [];

			// add measure name
			var measureName,
				measureLabel,
				mapping = {};
			measures.forEach(function (m) {
				if (datum[m.name]) {
					measureName = m.name;
					var label = m.label_short || m.label;
					if (typeof settings.measureLabels !== "undefined") {
						settings.measureLabels.map(function (meas) {
							return mapping[meas.split('|')[0]] = meas.split('|')[1];
						});
						measureLabel = mapping[label] || label;
					} else {
						measureLabel = label;
					}
				}
			});

			if (settings.measureSortFirst) {
				if (!settings.hideMeasureLabels) {
					tdData.push({ type: 'Measure Name', data: { 'value': measureName, 'rendered': measureLabel } });
				};
				dimensions.forEach(function (d) {
					tdData.push({ type: 'dimension', data: datum[d.name] });
				});
			}
			else {
				dimensions.forEach(function (d) {
					tdData.push({ type: 'dimension', data: datum[d.name] });
				});
				if (!settings.hideMeasureLabels) {
					tdData.push({ type: 'Measure Name', data: { 'value': measureName, 'rendered': measureLabel } });
				};
			}

			// add measure values for each pivot
			var measureData = datum[measureName];
			if (settings.pivotsAsDelta === true) {
				for (var i = 0; i < cols.length; i++) {
					if (i === 0) {
						tdData.push({ type: 'measure', data: measureData[cols[i].key] });
					} else {
						var numerator = measureData[cols[0].key].value;
						var denominator = measureData[cols[i].key].value;
						var val = denominator !== 0 && !isNaN(denominator) && denominator !== null ? numerator / denominator - 1 : null;
						var positive = val > 0;
						var invert = false;
						if (settings.invertedMeasures) {
							invert = settings.invertedMeasures.indexOf(measureLabel) >= 0;
						}
						var up_color = !invert ? 'green' : 'red';
						var down_color = !invert ? 'red' : 'green';
						var clr = positive ? up_color : val === null ? 'dimgray' : val === 0 ? 'dimgray' : down_color;
						var arrow = positive ? '▲' : val === null ? '' : val === 0 ? '' : '▼';
						var rend = (val * 100).toFixed(+settings.sigFigs) + '%';
						tdData.push({ type: 'measure',
							data: { 'value': val,
								'rendered': rend,
								'color': clr,
								'arrow': arrow
							}
						});
					}
				}
			} else {
				cols.forEach(function (c) {
					// console.log(c.key);
					tdData.push({ type: 'measure', data: measureData[c.key] });
				});
			}
			return tdData;
		});

		tds.enter().append('td');

		tds.exit().remove();

		tds
		// .style('background-color', function (d) {
		// 	return 0;
		// })
		.style('text-align', function (d) {
			if (d.type == 'measure') {
				return 'center';
			}
		}).html(function (d) {
			// var html = LookerCharts.Utils.htmlForCell(d.data);
			var html =
			'<span class="drillable-item" data-links="" data-context="" data-add-filter-json=""><span class="drillable-item-content">'
			+ (d.data.rendered || d.data.value) +
			'</span></span>';
			return html;
		});

		if (settings.colorDeltas === true) {
			tds.style('color', function (d) {
				return d.data.color || 'dimgray';
			}).html(function (d) {
				return (d.data.arrow || '') + LookerCharts.Utils.htmlForCell(d.data);
			});
		} else {
			tds.style('color', 'dimgray');
		}

	};

	looker.plugins.visualizations.add(viz);
})();
