import DOMPurify from "dompurify";
import React from "react";
import {
    Button,
    Menu,
    MenuButton,
    MenuItem,
    MenuItemLink,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Tooltip,
} from "@fluentui/react-components";

import * as FHIR from "@topical-ehr/fhir-types";
import { FhirSVG } from "@topical-ehr/ui-elements/FhirSVG";
import { fhirTypeId } from "@topical-ehr/fhir-types/FhirUtils";
import { GetRichTextContents, RichTextEditor } from "@topical-ehr/rich-text-editor";
import { useAppDispatch } from "@topical-ehr/fhir-store/store";
import { actions } from "@topical-ehr/fhir-store";
import { EditIcon, DeleteIcon } from "@topical-ehr/ui-elements/Icons";

import { ChangesView } from "./ChangesView";

import css from "./DocumentView.module.scss";
import { ReadIndicator } from "../ReadIndicator";

export interface Props {
    document: FHIR.Composition;
    time: string;
}

export function DocumentView(props: Props) {
    const composition = props.document;
    const title = composition?.section?.[0].title;
    const html = composition?.section?.[0].text?.div ?? "";

    const [edit, setEdit] = React.useState(false);

    const getRichTextContents = React.useRef<GetRichTextContents>();

    function onChanged(getContents: GetRichTextContents) {
        getRichTextContents.current = getContents;
    }

    const dispatch = useAppDispatch();

    function onSave() {
        const newComposition = getRichTextContents.current
            ? FHIR.Composition.setText(getRichTextContents.current(), composition)
            : composition;

        dispatch(actions.edit(newComposition));
        dispatch(
            actions.save({
                // only save this new composition
                filter: (res) => FHIR.isSameId(res, newComposition),
            })
        );
        onCancel();
    }

    function onDelete() {
        dispatch(actions.deleteImmediately(composition));
    }

    function markUnread() {
        dispatch(actions.markUnread(composition));
    }

    function onCancel() {
        setEdit(false);
    }

    return (
        <ReadIndicator resource={composition}>
            <div className={css.document}>
                <DocumentMenu
                    {...props}
                    setEdit={setEdit}
                    delete={onDelete}
                    markUnread={markUnread}
                />
                <div>
                    {props.time}
                    <h4>{title}</h4>
                </div>
                <div className={css.body}>
                    {!edit && (
                        <div
                            dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }),
                            }}
                        ></div>
                    )}

                    {edit && (
                        <>
                            <RichTextEditor
                                initialHTML={html}
                                placeholder={<></>}
                                onChange={onChanged}
                            />
                            <div className={css.buttons}>
                                <Button
                                    onClick={onSave}
                                    disabled={!getRichTextContents}
                                    appearance="primary"
                                >
                                    Save
                                </Button>
                                <Button onClick={onCancel}>Cancel</Button>
                            </div>
                        </>
                    )}

                    <ChangesView {...props} />
                </div>
            </div>
        </ReadIndicator>
    );
}

interface MenuProps {
    setEdit: (edit: boolean) => void;
    delete: () => void;
    markUnread: () => void;
}

function DocumentMenu(props: Props & MenuProps) {
    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <Tooltip
                    content="Open menu"
                    relationship="label"
                >
                    <MenuButton
                        shape="circular"
                        size="small"
                    />
                </Tooltip>
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    <MenuItem
                        icon={"️✉"}
                        onClick={() => props.markUnread()}
                    >
                        Mark as unread
                    </MenuItem>
                    <MenuItem
                        icon={<EditIcon />}
                        onClick={() => props.setEdit(true)}
                    >
                        Edit
                    </MenuItem>
                    <MenuItem
                        icon={<DeleteIcon />}
                        onClick={props.delete}
                    >
                        Delete
                    </MenuItem>
                    <MenuItemLink
                        href={`/edit-fhir?fhirUrl=${encodeURIComponent(fhirTypeId(props.document))}`}
                        target="_blank"
                        icon={<FhirSVG />}
                    >
                        FHIR
                    </MenuItemLink>
                </MenuList>
            </MenuPopover>
        </Menu>
    );
}
