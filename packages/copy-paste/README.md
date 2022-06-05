
# FullCalendar Copy-paste Plugin

The Plugin expands for [FullCalendar](https://fullcalendar.io/ "fullcalendar.io"), which aims to add copy and paste features using shortcuts.

<table role="table">
    <thead>
        <tr>
            <th>Actions</th>
            <th>Window</th>
            <th>Mac</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Copy</strong></td>
            <td>Ctrl + C</td>
            <td>Cmd + C</td>
            <td>Select event to copy.</td>
        </tr>
        <tr>
            <td><strong>Cut</strong></td>
            <td>Ctrl + X</td>
            <td>Cmd + X</td>
            <td>Select event to cut.</td>
        </tr>
        <tr>
            <td><strong>Paste</strong></td>
            <td>Ctrl + V</td>
            <td>Cmd + V</td>
            <td>Or you can press <strong>Enter</strong> or <strong>Click</strong> to paste.</td>
        </tr>
        <tr>
            <td><strong>Duplicate</strong></td>
            <td>Ctrl + D</td>
            <td>Cmd + D</td>
            <td>Instantly clone an event.</td>
        </tr>
        <tr>
            <td><strong>Cancel</strong></td>
            <td>ESC</td>
            <td>ESC</td>
            <td>Or click on the location outside the Calendar.</td>
        </tr>
    <tr>
    </tr></tbody>
</table>

<br />

## Installation
1. Install this library in your project.
```
npm i fullcalendar-copy-paste
```

<br />

2. Use the plugin.
```
...
import copyPastePlugin from 'fullcalendar-copy-paste'
...
new Calendar(calendarEl, {
    plugins: [copyPastePlugin],
    height: "100%",
    ...
```

<br />


## Configuration
<table role="table">
    <thead>
        <tr>
            <th>Fields</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>previewCopy</strong></td>
            <td>Boolean</td>
            <td>Default: true, Set <strong>false</strong> if the u wants to catch the event without wanting the view to change.</td>
        </tr>
        <tr>
            <td><strong>eventCopy</strong></td>
            <td>Callback</td>
            <td>Used when you want tho track changes of new and old events.</td>
        </tr>
    <tr>
    </tr></tbody>
</table>

Exp:
```
...
new Calendar(calendarEl, {
    plugins: [copyPastePlugin],
    height: "100%",
    previewCopy: false,
    eventCopy: (trigger) => {
        const oldEvent = trigger.oldEvent;
        const newEvent = trigger.event;
        const type = trigger.type;
        if (trigger.type === 'copy') {
            ...
        } else if (trigger.type === 'cut') {
            ...
        }
    }
  ...
}
```

<br />

## Demo:

#### Copy:
<p>
    <img src="https://raw.githubusercontent.com/toanS2/fullcalendar/master/examples/images/copy-m.gif" width="500" alt="Copy" />
</p>
<br />

#### Cut:
<p>
    <img src="https://raw.githubusercontent.com/toanS2/fullcalendar/master/examples/images/cut-m.gif" width="500" alt="Copy" />
</p>
<br />

#### Duplicate:
<p>
    <img src="https://raw.githubusercontent.com/toanS2/fullcalendar/master/examples/images/duplicate-m.gif" width="500" alt="Copy" />
</p>

<br />

Contributor: [ToanNguyen](https://github.com/toannguyen2 "ToanNguyen")

[@Classfunc](https://classfunc.com "Classfunc ")
