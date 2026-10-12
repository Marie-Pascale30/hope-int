// Point d'entree des composants d'interface partages (styles dans src/styles/globals.css).
// Sans "use client" : chaque module declare lui-meme s'il est client (Form, Tabs, Modal, DataTable)
// ou utilisable dans les composants serveur (Button, Display, Feedback, Skeleton).
export { cx, getFocusable, focusFirstInvalid } from "./utils";
export { Button } from "./Button";
export { Badge, StatusBadge, Card, PageHeader, Alert, ProgressBar, StatCard, Avatar } from "./Display";
export { LoadingState, EmptyState, ErrorState } from "./Feedback";
export { SkeletonLine, SkeletonRegion, SkeletonTable, PageSkeleton } from "./Skeleton";
export { fieldDescriptionIds, Field, Input, Textarea, Select, ChoiceGroup, Switch } from "./Form";
export { Tabs, tabPanelProps, TabPanel } from "./Tabs";
export { Modal } from "./Modal";
export { DataTable } from "./DataTable";
export { PhoneField, usePhoneErrorMessage } from "./PhoneField";
