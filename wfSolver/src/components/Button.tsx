import 'Button.css'

interface ButtonProps{
    text: string;
    onClick?: () => void,
    children?: React.ReactNode,
}

export function Button({text, onClick, children} : ButtonProps) {
    return (
    <button onClick={onClick}>
        {text}
        {children}
    </button>
    )
}