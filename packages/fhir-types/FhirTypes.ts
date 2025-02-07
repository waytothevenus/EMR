import { v4 as uuidv4 } from "uuid";

import { Codes } from "./FhirCodes";

// FHIR R4
// https://www.hl7.org/fhir/R4/

export interface Bundle<TResource> extends Resource {
    resourceType: "Bundle";
    type: string;
    total?: number;

    link: {
        relation: "self" | "next" | "previous";
        url: string;
    }[];

    entry?: {
        fullUrl: string;
        resource: TResource;
        request?: {
            method: string;
            url: string;
        };
        response?: {
            status: string;
            location?: string;
            etag?: string;
            lastModified?: string;
            outcome?: Resource;
        };
        search?: {
            mode: "match" | "include";
        };
    }[];
}
export function isBundle(r: Resource): r is Bundle<Resource> {
    return r.resourceType === "Bundle";
}
export const Bundle = {
    newTransaction(entries: Bundle<Resource>["entry"]) {
        const bundle: Bundle<Resource> = {
            resourceType: "Bundle",
            type: "transaction",
            id: newUuidId(),
            meta: {
                lastUpdated: new Date().toISOString(),
            },
            link: [],
            entry: entries,
        };
        return bundle;
    },
    putEntry(resource: Resource) {
        return {
            fullUrl: typeId(resource),
            resource,
            request: { method: "PUT", url: typeId(resource) },
        };
    },
    entry(resource: Resource) {
        const _new = isNew(resource);
        return {
            fullUrl: _new ? resource.id : typeId(resource),
            request: {
                method: _new ? "POST" : "PUT",
                url: _new ? resource.resourceType : typeId(resource),
            },
            resource,
        };
    },
};

export function parseRef(ref: string | null | undefined, resourceType?: string) {
    if (!ref) {
        return null;
    }
    if (resourceType) {
        if (ref.startsWith(resourceType) && ref[resourceType.length] === "/") {
            return { resourceType, id: ref.substring(resourceType.length + 1) };
        } else {
            // not of the required type
            return null;
        }
    } else {
        const s = ref.split("/");
        return { resourceType: s[0], id: s[1] };
    }
}

type Markdown = string;
type FhirDateTime = string;
type FhirTime = string;

interface Annotation {
    authorReference?: Reference;
    authorString?: string;
    text: Markdown;
    time: FhirDateTime;
}

export interface Coding {
    system?: string;
    version?: string;
    code?: string;
    display?: string;
    userSelected?: boolean;
}

export interface CodeableConcept {
    coding?: Coding[];
    text?: string;
}
export function areOverlapping(cc1: CodeableConcept, cc2: CodeableConcept) {
    const c1 = cc1.coding;
    const c2 = cc2.coding;
    if (!c1 || !c2) {
        return false;
    }
    return c1.some(({ code, system }) =>
        c2.some(
            ({ code: code2, system: system2 }) => code === code2 && system === system2
        )
    );
}

interface Period {
    start?: FhirDateTime;
    end?: FhirDateTime;
}

export interface Timing {
    // R4
    // https://www.hl7.org/fhir/datatypes-examples.html#Timing
    event?: FhirDateTime[];
    code?: CodeableConcept; // BID | TID | QID | AM | PM | QD | QOD | + (https://www.hl7.org/fhir/valueset-timing-abbreviation.html preferred)
    repeat?: {
        boundsDuration?: Quantity;
        boundsRange?: {}; // TODO
        boundsPeriod?: Period;
        count?: number; // Number of times to repeat
        countMax?: number; // Maximum number of times to repeat
        duration?: number; // How long when it happens
        durationMax?: number; // How long when it happens (Max)
        durationUnit?: string; // s | min | h | d | wk | mo | a - unit of time (UCUM)
        frequency?: number; // Event occurs frequency times per period
        frequencyMax?: number; // Event occurs up to frequencyMax times per period
        period?: number; // Event occurs frequency times per period
        periodMax?: number; // Upper limit of period (3-4 hours)
        periodUnit?: string; // s | min | h | d | wk | mo | a - unit of time (UCUM)
        dayOfWeek?: [string]; // mon | tue | wed | thu | fri | sat | sun
        timeOfDay?: [string]; // Time of day for action
        when?: [string]; // Code for time period of occurrence
        offset?: number; // Minutes from event (before or after)
    };
}

export interface Quantity {
    value?: number;
    comparator?: string;
    unit?: string;
    system?: string;
    code?: string;
}

export interface Range {
    low: Quantity;
    high: Quantity;
}

export interface Ratio {
    numerator: Quantity;
    denominator: Quantity;
}

export interface SampledData {
    // TODO
}

export interface Reference extends Element {
    reference?: string;
    _reference?: Element;
    type?: string;
    identifier?: Identifier;
    display?: string;
}

interface Identifier {
    use?: "usual" | "official" | "temp" | "secondary" | "old";
    type?: CodeableConcept;
    system?: string;
    value?: string;
    period?: Period;
}

interface WithKey {
    __key?: string;
}

export interface HumanName extends WithKey {
    use?: "usual" | "official" | "temp" | "nickname" | "anonymous" | "old" | "maiden";
    text?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
    period?: Period;
}

interface ContactPoint extends WithKey {
    use?: "home" | "work" | "temp" | "old" | "mobile";
    system?: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other";
    value?: string;
    rank?: number;
    period?: Period;
}

interface Attachment {
    contentType?: string;
    language?: string;
    data?: string;
    url?: string;
    size?: number;
    hash?: string;
    title?: string;
    creation?: FhirDateTime;
}

type FhirId = string;

export interface FhirResourceById<R> {
    [id: FhirId]: R;
}

export interface Resource {
    id: FhirId;
    resourceType: string;
    meta: {
        lastUpdated: string;
        versionId?: string;
    };
    extension?: Extension[];
    modifierExtension?: Extension[];
    text?: {
        status: string;
        div: string;
    };
}
export function isResource(r: any): r is Resource {
    return !!r.resourceType;
}

interface Extension {
    url: string;

    extension?: Extension[];

    valueBoolean?: boolean;
    valueCode?: string;
    valueCodeableConcept?: CodeableConcept;
    valueDate?: string;
    valueDateTime?: FhirDateTime;
    valueDecimal?: number;
    valueInteger?: number;
    valueInteger64?: string;
    valueMarkdown?: string;
    valuePeriod?: Period;
    valueQuantity?: Quantity;
    valueRange?: Range;
    valueRatio?: Ratio;
    valueReference?: Reference;
    valueSampledData?: SampledData;
    valueString?: string;
    valueTime?: FhirTime;
    valueUri?: string;
    valueUrl?: string;
}
interface Element {
    id?: string;
    extension?: Extension[];
}

export function newUuidId() {
    return `urn:uuid:${uuidv4()}`;
}

export function isNew(resource: Resource) {
    return resource.id.startsWith("urn:uuid:");
}

export function referenceTo(resource: Resource) {
    if (isNew(resource)) {
        return { reference: resource.id, type: resource.resourceType };
    } else {
        return { reference: resource.resourceType + "/" + resource.id };
    }
}

export function isSameId(r1: Resource, r2: Resource) {
    return r1.id === r2.id && r1.resourceType === r2.resourceType;
}

export function typeId(r: Resource) {
    return r.resourceType + "/" + r.id;
}

export function newMeta() {
    return {
        id: newUuidId(),
        meta: { lastUpdated: new Date().toISOString() },
    };
}

interface Address extends WithKey {
    use?: "home" | "work" | "temp" | "old" | "billing";
    type?: "postal" | "physical" | "both";
    text?: string;
    line?: string[];
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    period?: Period;
}

export interface Patient extends Resource {
    resourceType: "Patient";
    identifier?: Identifier[];
    active?: boolean;
    name?: HumanName[];
    telecom?: ContactPoint[];
    address?: Address[];
    gender?: "male" | "female" | "other" | "unknown";
    birthDate?: string;
    deceasedBoolean?: boolean;
    deceasedDateTime?: string;
}
export const Patient = {
    new(): Patient {
        return {
            resourceType: "Patient",
            ...newMeta(),
        };
    },
};

export interface Practitioner extends Resource {
    resourceType: "Practitioner";
    identifier?: Identifier[];
    active?: boolean;
    name?: HumanName[];
    telecom?: ContactPoint[];
    address?: Address[];
    gender?: "male" | "female" | "other" | "unknown";
    birthDate?: string;
    deceasedBoolean?: boolean;
    deceasedDateTime?: string;
}

export interface PractitionerRole extends Resource {
    resourceType: "PractitionerRole";
    identifier?: Identifier[];
    active?: boolean;
    practitioner?: Reference;
    organization?: Reference;
    location?: Reference[];
    characteristic?: CodeableConcept[];
    code?: CodeableConcept[];
    specialty?: CodeableConcept[];
}

export interface DiagnosticReport extends Resource {
    resourceType: "DiagnosticReport";
    status: string;
    code: CodeableConcept;
    category?: CodeableConcept[];
    identifier?: Identifier[];
    basedOn?: Reference[];

    effectiveDateTime?: FhirDateTime;
    issued?: FhirDateTime;

    subject?: Reference;
    encounter?: Reference;
    performer?: Reference;

    result?: Reference[];
    imagingStudy?: Reference[];
    media?: {
        link: Reference;
        comment?: string;
    }[];
    conclusion?: string;
    conclusionCode?: CodeableConcept[];
    presentedForm?: Attachment[];
}
export const DiagnosticReport = {
    new(props: Pick<DiagnosticReport, "code" | "subject" | "status">): DiagnosticReport {
        return {
            resourceType: "DiagnosticReport",
            ...newMeta(),
            ...props,
        };
    },
};

export interface Observation extends Resource, ObservationValue {
    resourceType: "Observation";
    status: string;
    code: CodeableConcept;
    category?: CodeableConcept[];
    bodySite?: CodeableConcept[];
    method?: CodeableConcept[];

    subject: Reference;
    encounter?: Reference;
    focus?: Reference[];
    performer?: Reference[];

    issued?: FhirDateTime;
    effectiveDateTime?: FhirDateTime;
    effectiveInstant?: FhirDateTime;
    effectivePeriod?: Period;
    effectiveTiming?: Timing;

    interpretation?: CodeableConcept[];
    dataAbsentReason?: CodeableConcept[];
    note?: Annotation[];

    referenceRange?: ObservationReferenceRange;

    component?: ({
        code: CodeableConcept;
        referenceRange?: ObservationReferenceRange;
    } & ObservationValue)[];

    hasMember?: Reference[];
    derivedFrom?: Reference[];
}
interface ObservationReferenceRange {
    low?: Quantity;
    high?: Quantity;
    type?: CodeableConcept;
    appliesTo?: CodeableConcept;
    age?: {
        low: Quantity;
        high: Quantity;
    };
    text?: string;
}

interface ObservationValue {
    valueQuantity?: Quantity;
    valueCodeableConcept?: CodeableConcept;
    valueString?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    valueRange?: Range;
    valueRatio?: Ratio;
    valueSampledData?: SampledData;
    valueTime?: FhirTime;
    valueDateTime?: FhirDateTime;
    valuePeriod?: Period;
}

export const Observation = {
    new(props: Pick<Observation, "code" | "subject" | "status">): Observation {
        return {
            resourceType: "Observation",
            ...newMeta(),
            ...props,
        };
    },
};

export interface Composition extends Resource {
    resourceType: "Composition";
    status: "preliminary" | "final" | "amended" | "entered-in-error";
    type: CodeableConcept;
    category?: CodeableConcept[];
    subject: Reference;
    encounter?: Reference;
    author?: Reference[];
    date: FhirDateTime;

    event?: {
        code?: CodeableConcept[];
        period?: Period;
        detail?: Reference[];
    }[];

    title: string;
    section?: CompositionSection[];
}
interface CompositionSection {
    title?: string;
    code?: CodeableConcept;
    text?: {
        status: "generated" | "extensions" | "additional" | "empty";
        div: string;
        _div?: Element;
    };
    entry?: Reference[];
    section?: CompositionSection[];
    author?: Reference[];
}
export function isComposition(r: Resource): r is Composition {
    return r.resourceType === "Composition";
}
export const Composition = {
    new(
        props: Pick<
            Composition,
            | "subject"
            | "status"
            | "type"
            | "category"
            | "date"
            | "title"
            | "section"
            | "encounter"
        >
    ): Composition {
        return {
            resourceType: "Composition",
            ...newMeta(),
            ...props,
        };
    },
    setText(content: { html: string; markdown: string }, c: Composition): Composition {
        const sections = c.section ?? [];
        const newSections: CompositionSection[] = [
            {
                ...sections[0],
                text: {
                    status: "additional",
                    div: `<div>${content.html}</div>`,
                    _div: {
                        extension: [
                            {
                                url: Codes.Extension.RenderingMarkdown,
                                valueMarkdown: content.markdown,
                            },
                        ],
                    },
                },
            },
            ...sections.slice(1),
        ];
        return { ...c, section: newSections };
    },
    getMarkdown(c: Composition): string | undefined {
        return c.section?.[0]?.text?._div?.extension?.filter(
            (e) => e.url === Codes.Extension.RenderingMarkdown
        )[0].valueMarkdown;
    },
    setEntries(newEntries: Reference[], c: Composition): Composition {
        const sections = c.section ?? [];
        const newSections = [{ ...sections[0], entry: newEntries }, ...sections.slice(1)];
        return { ...c, section: newSections };
    },
    addEntry(newEntry: Reference, c: Composition): Composition {
        const entries = c.section?.[0]?.entry ?? [];
        const newEntries = [...entries, newEntry];
        return Composition.setEntries(newEntries, c);
    },
    removeEntry(entryToRemove: Reference, c: Composition): Composition {
        const entries = c.section?.[0]?.entry ?? [];
        const newEntries = entries.filter((e) => e.reference !== entryToRemove.reference);
        return Composition.setEntries(newEntries, c);
    },
};

export interface Condition extends Resource {
    resourceType: "Condition";

    subject: Reference;
    encounter?: Reference;
    asserter?: Reference;
    recorder?: Reference;
    recordedDate?: FhirDateTime;

    onsetDateTime?: FhirDateTime;
    onsetAge?: Quantity;
    onsetPeriod?: Period;
    onsetRange?: Range;
    onsetString?: string;

    abatementDateTime?: FhirDateTime;
    abatementAge?: Quantity;
    abatementPeriod?: Period;
    abatementRange?: Range;
    abatementString?: string;

    note?: Annotation[];
    stage?: {
        summary?: CodeableConcept;
        type?: CodeableConcept;
        assessment?: Reference[];
    }[];
    evidence?: {
        code?: CodeableConcept[];
        detail?: Reference[];
    }[];

    code?: CodeableConcept;

    clinicalStatus?: CodeableConcept;
    // clinicalStatus?:
    //   | "active"
    //   | "recurrence"
    //   | "relapse"
    //   | "inactive"
    //   | "remission"
    //   | "resolved";

    verificationStatus?: CodeableConcept;
    // verificationStatus?:
    //   | "unconfirmed"
    //   | "provisional"
    //   | "differential"
    //   | "confirmed"
    //   | "refuted"
    //   | "entered-in-error";

    severity?: CodeableConcept;
    category?: CodeableConcept[];
    bodySite?: CodeableConcept[];
}
export const Condition = {
    new({ subject }: { subject: Reference }): Condition {
        return {
            resourceType: "Condition",
            ...newMeta(),
            subject,
        };
    },
};

export interface ValueSet extends Resource {
    expansion: {
        contains: [
            {
                system: string;
                code: string;
                display: string;
                designation?: [
                    {
                        value: string;
                        language?: string;
                        use?: {
                            system?: string;
                            code?: string;
                            version?: string;
                            display?: string;
                            userSelected?: boolean;
                        };
                    }
                ];
            }
        ];
    };
}
export type ValueSetCode = ValueSet["expansion"]["contains"][0];

export interface MedicationAdministration extends Resource {
    resourceType: "MedicationAdministration";

    status:
        | "in-progress"
        | "not-done"
        | "on-hold"
        | "completed"
        | "entered-in-error"
        | "stopped"
        | "unknown";
    statusReason?: CodeableConcept;
    category?: CodeableConcept;

    medicationCodeableConcept?: CodeableConcept;
    medicationReference?: Reference;
    reasonCode?: CodeableConcept[];
    reasonReference?: Reference[];
    supportingInformation?: Reference[];

    subject: Reference;
    context?: Reference;
    effectiveDateTime?: string;

    note?: Annotation[];

    dosage?: {
        text?: string;
        site?: CodeableConcept;
        route?: CodeableConcept;
        method?: CodeableConcept;

        dose?: Quantity;
        rateRatio?: Ratio;
        rateQuantity?: Quantity;
    };
}
export const MedicationAdministration = {
    new({
        subject,
        status,
        dateTime,
    }: {
        subject: Reference;
        status: MedicationAdministration["status"];
        dateTime: Date;
    }): MedicationAdministration {
        return {
            resourceType: "MedicationAdministration",
            ...newMeta(),
            effectiveDateTime: dateTime.toISOString(),
            subject,
            status,
        };
    },
};

// https://www.hl7.org/fhir/R4/medicationrequest.html
export interface MedicationRequest extends Resource {
    resourceType: "MedicationRequest";

    status:
        | "active"
        | "on-hold"
        | "cancelled"
        | "completed"
        | "entered-in-error"
        | "stopped"
        | "draft"
        | "unknown";
    intent:
        | "proposal"
        | "plan"
        | "order"
        | "original-order"
        | "reflex-order"
        | "filler-order"
        | "instance-order"
        | "option";

    medicationCodeableConcept?: CodeableConcept;
    medicationReference?: Reference;
    reasonCode?: CodeableConcept[];
    reasonReference?: Reference[];
    supportingInformation?: Reference[];

    subject: Reference;
    encounter?: Reference;
    requester?: Reference;

    note?: Annotation[];

    dosageInstruction?: {
        sequence?: number;
        text?: string;
        additionalInstruction?: CodeableConcept[];
        patientInstruction?: string;
        timing?: Timing;

        site?: CodeableConcept;
        route?: CodeableConcept;
        method?: CodeableConcept;

        doseAndRate?: {
            type?: CodeableConcept; // calculated, ordered, etc

            doseRange?: Range;
            doseQuantity?: Quantity;

            // rate[x]: Amount of medication per unit of time. One of these 3:
            rateRatio?: Ratio;
            rateRange?: Range;
            rateQuantity?: Quantity;
        }[];
    }[];
}
export const MedicationRequest = {
    new({
        subject,
        status,
        intent,
    }: {
        subject: Reference;
        status: MedicationRequest["status"];
        intent: MedicationRequest["intent"];
    }): MedicationRequest {
        return {
            resourceType: "MedicationRequest",
            ...newMeta(),
            subject,
            status,
            intent,
        };
    },
};

export interface ServiceRequest extends Resource {
    resourceType: "ServiceRequest";

    status:
        | "draft"
        | "active"
        | "on-hold"
        | "revoked"
        | "completed"
        | "entered-in-error"
        | "unknown";
    intent:
        | "proposal"
        | "plan"
        | "directive"
        | "order"
        | "original-order"
        | "reflex-order"
        | "filler-order"
        | "instance-order"
        | "option";

    category?: CodeableConcept;
    code?: CodeableConcept;

    subject: Reference;
    encounter?: Reference;
    requester?: Reference;

    supportingInfo?: Reference[];
    reasonCode?: CodeableConcept[];
    reasonReference?: Reference[];
    note?: Annotation[];
}
export const ServiceRequest = {
    new({
        subject,
        status,
        intent,
    }: {
        subject: Reference;
        status: ServiceRequest["status"];
        intent: ServiceRequest["intent"];
    }): ServiceRequest {
        return {
            resourceType: "ServiceRequest",
            ...newMeta(),
            subject,
            status,
            intent,
        };
    },
};

export interface Task extends Resource {
    resourceType: "Task";

    status: "draft" | "requested" | "received" | "accepted";
    intent: "unknown" | "proposal" | "plan" | "order" | "option";

    code?: CodeableConcept;
    description?: string;
    priority?: "routine" | "urgent" | "asap" | "stat";

    for: Reference;
    encounter?: Reference;
    owner?: Reference;

    supportingInfo?: Reference[];
    reasonCode?: CodeableConcept;
    reasonReference?: Reference;
    note?: Annotation[];
}

export interface List extends Resource {
    resourceType: "List";

    status: "current" | "retired" | "entered-in-error";
    mode: "working" | "snapshot" | "changes";

    title?: string;
    code?: CodeableConcept;

    subject?: Reference;
    encounter?: Reference;
    source?: Reference;

    note?: Annotation[];
    entry?: {
        flag?: CodeableConcept;
        deleted?: boolean;
        date?: string;
        item: Reference;
    }[];
}
export function isList(r: Resource): r is List {
    return r.resourceType === "List";
}

export interface Group extends Resource {
    resourceType: "Group";

    identifier?: Identifier[];
    active?: boolean;
    type: "person" | "animal" | "practitioner" | "device" | "medication" | "substance";
    actual: boolean;

    code?: CodeableConcept;
    name?: string;

    managingEntity?: Reference;

    characteristic?: {
        code: CodeableConcept;
        valueCodeableConcept?: CodeableConcept;
        exclude: boolean;
        period?: Period;
    }[];

    member?: {
        entity: Reference;
        period?: Period;
        inactive?: boolean;
    }[];
}
export function isGroup(r: Resource): r is Group {
    return r.resourceType === "Group";
}

export interface Encounter extends Resource {
    resourceType: "Encounter";
    identifier?: Identifier[];
    status:
        | "planned"
        | "arrived"
        | "triaged"
        | "in-progress"
        | "onleave"
        | "finished"
        | "cancelled";

    class: Coding;
    type?: CodeableConcept[];
    serviceType?: CodeableConcept;
    priority?: CodeableConcept;

    subject?: Reference;
    serviceProvider?: Reference;
    partOf?: Reference;
    episodeOfCare?: Reference[];
    basedOn?: Reference[];
    account?: Reference;

    period?: Period;

    reasonCode?: CodeableConcept[];
    reasonReference?: Reference[];

    diagnosis?: {
        condition: Reference;
        use?: CodeableConcept;
        rank?: number;
    }[];

    hospitalization?: {
        // TODO
    }[];

    location?: {
        location: Reference;
        status?: "planned" | "active" | "reserved" | "completed";
        physicalType?: CodeableConcept;
        period?: Period;
    }[];
}
export const Encounter = {
    new(props: Pick<Encounter, "status" | "class" | "subject" | "period">): Encounter {
        return {
            resourceType: "Encounter",
            ...newMeta(),
            ...props,
        };
    },
};
