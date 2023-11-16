/**
 * Append inpaint buttons to shape controls
 * @param {*} controls
 * @param {*} settings
 * @returns
 */
export const appendRetouchInpaintButtons = (
    controls,
    {
        activeShape,
        onupdate,
        ongenerate,
        labelEdit = 'Edit prompt',
        labelGenerate = 'Generate more',
    }
) => {
    if (activeShape.status === 'loading' || !activeShape.inpaint) return;

    const { prompt, selection } = activeShape.inpaint;

    controls.push([
        'div',
        'promptnav',
        {
            class: 'PinturaShapeControlsGroup',
        },
        [
            [
                'Button',
                'edit',
                {
                    icon: `<path d="M15,5 C17.7614237,5 20,7.23857625 20,10 L20,14 C20,16.7614237 17.7614237,19 15,19 L9,19 C7.33333333,19 5.66666667,19.6666667 4,21 C4.46065808,19.6180258 4.96110477,18.4747831 5.50134005,17.5702721 C4.57467285,16.664034 4,15.399128 4,14 L4,10 C4,7.23857625 6.23857625,5 9,5 L15,5 Z M8.5,14 L8,16 L10,15.5 L8.5,14 Z M13,9.5 L9,13.5 L10.5,15 L14.5,11 L13,9.5 Z M14.5,8 L13.5,9 L15,10.5 L16,9.5 L14.5,8 Z" fill="currentColor"/>`,
                    label: labelEdit,
                    hideLabel: true,
                    onclick: () => onupdate({ shapePrompt: prompt }),
                },
            ],
            [
                'Button',
                'refresh',
                {
                    icon: `<path d="M16.8108172,6.91509368 C15.5565287,5.72800578 13.8632818,5 12,5 C8.13400675,5 5,8.13400675 5,12 C5,15.8659932 8.13400675,19 12,19 C15.8659932,19 19,15.8659932 19,12" fill="none" stroke="currentColor" stroke-width="2"/><polygon fill="currentColor" points="17.5 4 14.5 8.5 20 9"/><g fill="currentColor"><circle cx="9" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="15" cy="12" r="1"/></g>`,
                    label: labelGenerate,
                    hideLabel: true,
                    onclick: () =>
                        ongenerate({
                            shapePrompt: prompt,
                            shapeSelection: selection,
                        }),
                },
            ],
        ],
    ]);
};

/**
 * Append inpaint result navigation to shape controls
 * @param {*} controls
 * @param {*} settings
 * @returns
 */
export const appendRetouchInpaintResultNavigation = (
    controls,
    { activeShape, onupdate, labelPrevious = 'Previous', labelNext = 'Next' }
) => {
    if (
        activeShape.status === 'loading' ||
        !activeShape.inpaint ||
        activeShape.inpaint.results.length <= 1
    )
        return;

    // update shape with new background
    const updateShapeWithIndex = (getIndex) => {
        const { results } = activeShape.inpaint;
        const currentResultIndex = results.findIndex(
            (result) => result === activeShape.backgroundImage
        );
        const nextResultIndex = getIndex(currentResultIndex, results.length);
        onupdate({ shapeBackgroundImage: results[nextResultIndex] });
    };

    // set next inpaint result
    const next = () => updateShapeWithIndex((i, l) => (i + 1 >= l ? 0 : i + 1));

    // set previous inpaint result
    const prev = () =>
        updateShapeWithIndex((i, l) => (i === 0 ? l - 1 : i - 1));

    // add prev/next buttons
    controls.push([
        'div',
        'resultnav',
        {
            class: 'PinturaShapeControlsGroup',
        },
        [
            [
                'Button',
                'previous',
                {
                    label: labelPrevious,
                    hideLabel: true,
                    icon: '<path fill="currentColor" d="M 16 16 16 8 8 12 z"/>',
                    onclick: prev,
                },
            ],
            [
                'Button',
                'next',
                {
                    label: labelNext,
                    hideLabel: true,
                    icon: '<path fill="currentColor" d="M 16 12 8 16 8 8 z"/>',
                    onclick: next,
                },
            ],
        ],
    ]);
};

/**
 * Append feather slider to shape controls
 * @param {*} controls
 * @param {*} settings
 * @returns
 */
export const appendRetouchFeatherSlider = (
    controls,
    {
        value,
        onchange,
        labelFeather = 'Feather edges',
        options = [
            [0, 'Disabled'],
            ['1%', 'Small'],
            ['2.5%', 'Medium'],
            ['5%', 'Large'],
        ],
    }
) => {
    // no feather prop so no need to show control
    if (value === undefined) return controls;

    controls.push([
        'div',
        'imageblend',
        {
            class: 'PinturaShapeControlsGroup',
        },
        [
            [
                'Dropdown',
                'feather',
                {
                    label: labelFeather,
                    options,
                    value,
                    onchange,
                },
            ],
        ],
    ]);

    return controls;
};

/**
 * Creates a new inpaint shape or updates a taret shape
 * @param {*} editor
 * @param {*} createRetouchShape
 * @param {*} prompt
 * @param {*} selection
 * @param {*} targetShape
 * @returns
 */
export const createInpaintShape = (
    editor,
    createRetouchShape,
    prompt,
    selection,
    targetShape
) =>
    createRetouchShape(
        // necessary image data
        editor.imageFile,
        editor.imageSize,
        editor.imageState,

        // pass selection
        selection,

        // this function will do the inpainting
        async (imageBlob, maskBlob, { shape, controller }) => {
            // get inpaint results
            const results = await requestInpaintResults(
                imageBlob,
                maskBlob,
                prompt,
                {
                    // enable to see the files being sent and receives
                    debug: false,

                    // total results we want back
                    count: 4,

                    // pass controller so we can cancel
                    controller,
                }
            );

            // no results received
            if (!results) throw 'Something went wrong';

            // update shape with results
            Object.assign(shape, {
                backgroundImage: results[0],
                feather: '1%',
                isSelected: true,
                inpaint: {
                    ...shape.inpaint,
                    results: [...results, ...shape.inpaint.results],
                },
            });
        },
        // our editor params
        {
            // extra spacing around mask
            padding: 0,

            // scale down
            targetSize: {
                width: 512,
                height: 512,
            },

            // we want a square canvas
            forceSquareCanvas: true,

            // current retouches so new inpaint blends, we remove the targetShape if it is set
            retouches: targetShape
                ? editor.imageManipulation.filter(
                      (shape) => shape.id !== targetShape.id
                  )
                : editor.imageManipulation,

            // optional add to editor image manipulation so we see things happening right away
            didCreateDraft: (draftShape, { selection }) => {
                if (targetShape) {
                    // update shape
                    Object.assign(draftShape, targetShape);

                    // set inpaint state
                    draftShape.inpaint = targetShape.inpaint;

                    // replace target shape
                    editor.imageManipulation = editor.imageManipulation.map(
                        (shape) => {
                            if (shape.id !== draftShape.id) return shape;
                            return draftShape;
                        }
                    );
                } else {
                    // add the shape
                    draftShape.inpaint = {
                        prompt,
                        results: [],
                        selection: [...selection],
                    };

                    editor.imageManipulation = [
                        ...editor.imageManipulation,
                        draftShape,
                    ];
                }
            },
        }
    ).then((finalShape) => {
        // final prompt shape is done, let's replace it!
        editor.imageManipulation = editor.imageManipulation.map((shape) => {
            if (shape.id !== finalShape.id) return shape;
            return finalShape;
        });
    });

/**
 * Request user text input for inpaint action
 * @param {*} editor
 * @param {*} settings
 * @returns
 */
export const requestInpaintPrompt = (
    editor,
    { text = '', onconfirm, onerror, onclose } = {}
) => {
    if (!onconfirm) return;

    const handleTextInputConfirm = (text) => {
        // inpaint shape
        onconfirm(text);

        // closing!
        onclose && onclose();
    };

    const handleTextInputCancel = (err) => {
        // if err is undefined, cancel selection
        // if err, something went wrong
        if (err) onerror && onerror(err);

        // clear selection
        // editor.imageSelection = [];
        onclose && onclose();
    };

    // request user input
    editor.showTextInput(
        // event handlers
        handleTextInputConfirm,
        handleTextInputCancel,

        // configuration
        {
            // position
            align: 'top',
            justify: 'center',

            // input
            text,
            placeholder: 'Leave empty to use background',

            // buttons
            buttonConfirm: {
                // shows label by default
                label: 'Generate',
            },

            buttonCancel: {
                // don't show label
                hideLabel: true,

                // label to use
                label: 'Cancel',

                // icon to add
                icon: '<g stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></g>',
            },
        }
    );
};

/**
 * Create a clean shape based on retouch shape
 * @param {*} editor
 * @param {*} createRetouchShape
 * @param {*} selection
 */
export const createCleanShape = (editor, createRetouchShape, selection) => {
    createRetouchShape(
        editor.imageFile,
        editor.imageSize,
        editor.imageState,
        selection,
        async (imageBlob, maskBlob, { shape, controller }) => {
            // get blob for new texture
            const backgroundBlob = await requestCleanResult(
                imageBlob,
                maskBlob,
                {
                    controller,
                    debug: false,
                }
            );

            // update shape
            shape.backgroundImage = URL.createObjectURL(backgroundBlob);
        },
        {
            // add some extra spacing around shape so algo has more info
            padding: 40,

            // current retouches so new inpaint blends
            retouches: editor.imageManipulation,

            // optional add to editor image manipulation so we see things happening right away
            didCreateDraft: (draftShape) => {
                editor.imageManipulation = [
                    ...editor.imageManipulation,
                    draftShape,
                ];
            },
        }
    ).then((finalShape) => {
        // let's update shape with final contents
        editor.imageManipulation = editor.imageManipulation.map((shape) => {
            if (finalShape.id !== shape.id) return shape;
            return finalShape;
        });
    });
};

/**
 * Listen for selection changes and determine if should run clean action
 * @param {*} editor
 * @param {*} createRetouchShape
 */
export const attachCleanAction = (editor, createRetouchShape) => {
    // when selection created we want to run a clean action on its contents
    editor.on('selectionup', (selectionItems) => {
        // get last item
        const lastSelectionItem = selectionItems[selectionItems.length - 1];

        // is not a "clean" selection action
        if (!lastSelectionItem || lastSelectionItem.action !== 'clean') return;

        // clone selection so we can clear it before proceeding
        const currentSelection = [...editor.imageSelection];

        // clear current selection
        editor.imageSelection = [];

        createCleanShape(editor, createRetouchShape, currentSelection);
    });
};

/**
 * Listens for selection changes and determine if should open inpaint prompt
 * @param {*} editor
 * @param {*} createRetouchShape
 */
export const attachInpaintAction = (editor, createRetouchShape) => {
    // if selection is started, hide text input
    editor.on('selectiondown', () => {
        editor.hideTextInput();
    });

    // decide what to do when a selection is created
    editor.on('selectionup', (selectionItems) => {
        const lastSelectionItem = selectionItems[selectionItems.length - 1];

        // is not a "inpaint" selection action
        if (!lastSelectionItem || lastSelectionItem.action !== 'inpaint')
            return;

        // is inpaint selection let's request a prompt for this selection
        requestInpaintPrompt(editor, {
            onconfirm: (text) => {
                createInpaintShape(
                    editor,
                    createRetouchShape,
                    text,
                    editor.imageSelection,
                    undefined
                );
            },
            onclose: () => {
                // clear selection
                editor.imageSelection = [];
            },
            onerror: (err) => {
                // handle error
            },
        });
    });
};

//
// API integrations
//

/**
 * Uses ClipDrop API to remove a masked object from an image, this posts directly to ClipDrop server
 * @param { Blob } imageBlob
 * @param { Blob } maskBlob
 * @param { { controller?: AbortController, debug: boolean } } options
 * @returns { Promise<Blob> }
 */
const requestCleanResult = (imageBlob, maskBlob, options = {}) =>
    new Promise(async (resolve, reject) => {
        const { controller, debug = false } = options;

        // show input images
        if (debug) {
            console.log({ imageBlob, maskBlob });
            const imgA = new Image();
            imgA.src = URL.createObjectURL(imageBlob);
            const imgB = new Image();
            imgB.src = URL.createObjectURL(maskBlob);
            document.body.append(imgA, imgB);
        }

        // data to send to inpaint API
        const form = new FormData();
        form.append('image', imageBlob);
        form.append('mask', maskBlob);

        const res = await fetch('http://localhost:3000/api/clean', {
            method: 'POST',
            body: form,
            signal: controller.signal,
        });

        if (res.status !== 200) {
            reject('Something went wrong');
        }

        const blob = await res.blob();

        if (debug) {
            console.log({ outputBlob: blob });
            const img = new Image();
            img.src = URL.createObjectURL(blob);
            document.body.append(img);
        }

        resolve(blob);
    });

/**
 * Uses Replicate API to inpaint an object, this posts to a local server which communicates with Replicate
 * @param { Blob } imageBlob
 * @param { Blob } maskBlob
 * @param { { controller?: AbortController, debug: boolean } } options
 * @returns { Promise<Blob> }
 */
const requestInpaintResults = async (
    imageBlob,
    maskBlob,
    prompt,
    options = {}
) =>
    new Promise(async (resolve, reject) => {
        const { controller, count, debug = false } = options;

        // did we abort
        let didAbort = false;

        // show input images
        if (debug) {
            const imgB = new Image();
            imgB.src = URL.createObjectURL(maskBlob);
            const imgA = new Image();
            imgA.src = URL.createObjectURL(imageBlob);
            document.body.append(imgB, imgA);
        }

        // data to send to inpaint API
        const formData = new FormData();
        formData.append('image', imageBlob);
        formData.append('mask', maskBlob);
        formData.append('prompt', prompt);
        formData.append('outputs', count);

        // start inpaint process for this data
        const res = await fetch(
            // replace with path to server location to start inpaint process
            'http://localhost:3000/api/inpaint',
            {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            }
        )
            .then((res) => res.json())
            .catch((err) => reject(err));

        // bail if no response
        if (!res) return;

        // get job id so we can use it when polling for results
        const { id } = res;

        // so we can abort
        controller.signal.onabort = () => {
            clearTimeout(pollId);
            didAbort = true;
            reject(new Error('Aborted'));
        };

        // start polling for result
        let pollId;
        let pollAttempt = 0;
        const MaxAttempts = 20;
        const poll = async () => {
            // stop because aborted
            if (didAbort) return;

            // aborted by user
            if (pollAttempt >= MaxAttempts) {
                reject(new Error('Timed out'));
                return;
            }

            // see if results are in
            pollAttempt++;
            console.log('Poll #', pollAttempt);

            const { output } = await fetch(
                // replace with path to server location to poll inpaint progress
                'http://localhost:3000/api/inpaint/' +
                    id +
                    '?bust=' +
                    Date.now(),
                {
                    signal: controller.signal,
                }
            ).then((res) => res.json());

            // no output, let's wait for next attempt
            if (!output) {
                pollId = setTimeout(poll, 1000);
                return;
            }

            // show output images (array of image urls)
            if (debug) {
                for (const src of output) {
                    const img = new Image();
                    img.src = src;
                    document.body.append(img);
                }
            }

            console.log('Got results', output.length);

            // done!
            resolve(output);
        };

        // start polling
        pollId = setTimeout(poll, 1000);
    });
