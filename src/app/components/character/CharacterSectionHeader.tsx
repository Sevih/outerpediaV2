type Props = {
  title: string;
};

/** Editorial section header — relies on the global h2 underline (no extra rule). */
export default function CharacterSectionHeader({ title }: Props) {
  return <h2 className="mb-4 text-2xl font-bold">{title}</h2>;
}
