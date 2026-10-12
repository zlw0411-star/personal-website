import EntryEditor from "@/components/admin/EntryEditor";
export default function NewEntryPage(){
 const initialCategory="learning";
 return <EntryEditor key={initialCategory} initialCategory={initialCategory}/>;
}
